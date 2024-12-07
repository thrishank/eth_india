import { Telegraf } from "telegraf";
import { login, login_okto, verify_login_otp } from "./commands/login";
import { getUserState, resetUserState, saveTokens, updateUserState } from "./prisma";
import { APIResponse } from "./types/type";
import { Prisma, PrismaClient } from "@prisma/client";
import { do_transfer, transfer } from "./commands/transfer";
import { request } from "undici";
 
import { get_wallet } from "./lib/wallet";
import { do_swap } from "./commands/swap";
import { processUserInput } from "./lib/ai";


const bot_token = "7887692704:AAE9g8oEGMB-REyHu7ZITvzrVLOG10f11Mc"
const bot = new Telegraf(bot_token);
const prisma = new PrismaClient();

const menu_bar_commands = [
    { command: "help", description: "Start the bot" },
    { command: "logout", description: "Logout of the bot" },
];
bot.telegram.setMyCommands(menu_bar_commands);

bot.start((ctx) => {
    return ctx.reply("Welcome to the OKTO bot!. I am your AI assistant. How can I help you today?");
})

bot.command("login", (ctx) => {
    login(ctx);
})

bot.command("wallet", async (ctx) => {
    const userId = ctx.from.id.toString();
    const token = await prisma.userAuth.findUnique({
        where: {
            userId
        }
    })

    if (!token) {
        return ctx.reply("You are not logged in. Use /login to authenticate.");
    }
    const res = await request('https://sandbox-api.okto.tech/api/v1/wallet', {
        headers: {
            Authorization: `Bearer ${token?.authToken}`,
            "User-Agent": "NextJSDev/1.0",
            Referer: "http://localhost:3000",
        }
    })

    const response_data = await res.body.json();

    // @ts-ignore
    const base_wallet = response_data.data.wallets.find((wallet: any) => wallet.network_name === "BASE");

    ctx.reply(`Your BASE wallet address is:\n<code>${base_wallet.address}</code>`, {
        parse_mode: 'HTML'
    });
})

bot.command("portfolio", async (ctx) => {
    const userId = ctx.from.id.toString();
    const token = await prisma.userAuth.findUnique({
        where: {
            userId
        }
    })

    if (!token) {
        return ctx.reply("You are not logged in. Use /login to authenticate.");
    }
    const res = await request('https://sandbox-api.okto.tech/api/v1/portfolio', {
        headers: {
            Authorization: `Bearer ${token?.authToken}`,
            "User-Agent": "NextJSDev/1.0",
            Referer: "http://localhost:3000",
        }
    })

    const data = await res.body.json();

    const formatTokenMessage = (data: any) => {
        if (data.status !== 'success' || !data.data.tokens) {
            return 'No token data available.';
        }
    
        interface Token {
            token_name: string,
            quantity: string,
            amount_in_inr: string,
            token_image: string,
            token_address: string,
            network_name: string
        }
    
        const baseTokens = data.data.tokens.filter((token: Token) => token.network_name === 'BASE');
    
        if (baseTokens.length === 0) {
            return '🔹 No tokens found on BASE network.';
        }
    
        const tokenLines = baseTokens.map((token: Token) =>
            `📊 <b>${token.token_name}</b>\n` +
            `   Quantity: <code>${token.quantity}</code>\n` +
            `   Value: ₹<code>${token.amount_in_inr}</code>`
        ).join('\n\n');
    
        return `🔹 Your BASE Network Tokens:\n\n${tokenLines}`;
    };
    ctx.reply(formatTokenMessage(data), {
        parse_mode: 'HTML'
    });
})
bot.command("transfer", (ctx) => {
    transfer(ctx);
})

bot.command("swap", async (ctx) => {
    const userId = ctx.from!.id.toString();

  const { stage, context } = await getUserState(userId);

  if (stage !== "neutral") {
    return ctx.reply(
      "You are already in the middle of another process. Use /cancel to reset the current flow."
    );
  }

  await updateUserState(userId, {
    stage: "from_token",
    context: { isAI: false, command: "swap", sub_command: "from_token" },
  });

  return ctx.reply("Which token would you like to swap (e.g., USDC, ETH)?");
})

bot.command("history", async (ctx) => {

})
bot.command("cancel", async (ctx) => {
    const userId = ctx.from.id.toString();

    try {
        // Update the user state to reset it
        await prisma.userState.update({
            where: { userId },
            data: {
                stage: 'initial', // or whatever initial stage you want
                context: '' // reset context
            }
        });
    } catch (error) {
        // If the user state doesn't exist, we can safely ignore this error
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')) {
            throw error;
        }
    }

    // Delete all tokens for this user
    await prisma.token.deleteMany({
        where: { userId }
    });

    // Delete all current processes for this user
    await prisma.current_process.deleteMany({
        where: { userId }
    });

    return ctx.reply("Flow canceled. Use /login to start again.");
});
bot.command("logout", async (ctx) => {
    const userId = ctx.from.id.toString();
    await resetUserState(userId);
    await prisma.userAuth.delete({
        where: {
            userId
        }
    });

    return ctx.reply("You have been logged out.");
})

bot.on("text", async (ctx) => {
    const userId = ctx.from.id.toString();

    const { stage, context } = await getUserState(userId);

    // Check for new command
    const message = ctx.message.text.trim();
    const newCommand = message.startsWith('/') ? message.toLowerCase() : null;

    // If a new command is entered, reset the context and process the command
    if (newCommand) {
        if (newCommand === '/login') {
            await updateUserState(userId, {
                stage: "email",
                context: {
                    command: "login",
                    sub_command: "",
                    isAI: false
                }
            });
            return ctx.reply("Please enter your email address:");
        }

        if (newCommand === '/cancel') {
            // Reset user state completely
            await resetUserState(userId);

            return ctx.reply("Current process has been canceled. What would you like to do next?");
        }

        // Add handling for other commands here
        // For example:
        // if (newCommand === '/start') { ... }
        // if (newCommand === '/help') { ... }

        // If command is not recognized
        return ctx.reply("Sorry, I don't recognize that command.");
    }

    if (context.isAI) {
        const user_prompt = ctx.message.text.trim();
        const userId = ctx.from.id.toString();
        const ai_res = await processUserInput(user_prompt);
        if(ai_res.command === "transfer"){
            const data = ai_res.data;
            // ammount, address, token if all is there 
            await updateUserState(userId, {
                stage: "confirmation",
                context: { ...context, sub_command: "confirmation" },
            });

            await prisma.current_process.create({
                data: {
                    userId: userId,
                    data: JSON.stringify({
                        token: data?.token,
                        address: data?.address,
                        amount: data?.amount
                    })
                }
            })
            // why is this confiliting with the cancel order
            await ctx.reply("/transfer");
        } else{
            ctx.reply("/"+ai_res.command);
        }
    }

     
    if (context.command === "login") {
        if (stage === "email") {
            const email = ctx.message.text;

            if (!email.includes("@")) {
                return ctx.reply("Invalid email. Please enter a valid email address:");
            }

            const res = await login_okto(email);
            if (res.status === "success") {
                await prisma.token.create({
                    data: {
                        userId: userId!,
                        token: res.data.token,
                        email: email
                    }
                })
            }

            await updateUserState(userId, {
                stage: "otp",
                context: { ...context, sub_command: "otp" },
            });

            return ctx.reply(`Please enter the OTP:`);
        }

        if (stage === "otp") {
            const otp = ctx.message.text;
            console.log(otp);
            const otp_data = await prisma.token.findFirst({
                where: {
                    userId: userId!
                }
            })


            const apiResponse: APIResponse = await verify_login_otp(otp, otp_data?.token!, otp_data?.email!);
            await prisma.token.delete({
                where: {
                    id: otp_data?.id
                }
            })

            if (apiResponse.status === "success") {
                await saveTokens(userId, apiResponse.data);
                await updateUserState(userId, {
                    stage: "authenticated",
                    context: { isAI: true, command: "", sub_command: "" }
                });

                return ctx.reply("Login successful! 🎉");
            } else {
                return ctx.reply("Verification failed. Please try again.");
            }
        }
    }

    if (context.command === "transfer") {

        switch (stage) {
            case "token_name": {
                const tokenName = ctx.message.text.toUpperCase();

                if (!["USDC", "ETH"].includes(tokenName)) {
                    return ctx.reply("Invalid token. Please enter a valid token name:");
                }

                await prisma.current_process.create({
                    data: {
                        userId: userId,
                        data: JSON.stringify({
                            token: tokenName
                        })
                    }
                })

                await updateUserState(userId, {
                    stage: "receiver_address",
                    context: { sub_command: "receiver_address",  command: "transfer", isAI: false }
                });

                return ctx.reply("Please enter the receiver's wallet address:");
            }
            case "receiver_address": {
                const address = ctx.message.text;
                // input validation and baseNames

                const existingData = await prisma.current_process.findFirst({
                    where: {
                        userId: userId
                    }
                })

                console.log(existingData);
                await prisma.current_process.update({
                    where: {
                        id: existingData?.id!
                    },
                    data: {
                        data: {
                            set: JSON.stringify({
                                ...JSON.parse(existingData?.data!),
                                address: address
                            })
                        }
                    }
                })
                await updateUserState(userId, {
                    stage: "amount",
                    context: { ...context, sub_command: "amount" },
                });

                return ctx.reply(`Wallet address ${address} received. Enter the amount to transfer:`);
            }
            case "amount": {
                const amount = parseFloat(ctx.message.text);

                if (isNaN(amount) || amount <= 0) {
                    return ctx.reply("Invalid amount. Please enter a valid number:");
                }

                const existingData = await prisma.current_process.findFirst({
                    where: {
                        userId: userId
                    }
                })

                await prisma.current_process.update({
                    where: {
                        id: existingData?.id!
                    },
                    data: {
                        data: {
                            set: JSON.stringify({
                                ...JSON.parse(existingData?.data!),
                                amount: amount
                            })
                        }
                    }
                })

                await updateUserState(userId, {
                    stage: "confirmation",
                    context: { ...context, sub_command: "confirmation" },
                });

                return ctx.reply(
                    `You are about to transfer ${amount} ${JSON.parse(existingData?.data!).token} to ${JSON.parse(existingData?.data!).address}.\n\nConfirm? (yes/no)`
                );
            }
            case "confirmation": {
                const confirmation = ctx.message.text.toLowerCase();

                if (confirmation !== "yes" && confirmation !== "no") {
                    return ctx.reply('Please type "yes" to confirm or "no" to cancel.');
                }

                if (confirmation === "no") {
                    await resetUserState(userId);
                    return ctx.reply("Transfer canceled. Use /transfer to start again.");
                }

                const db_data = await prisma.current_process.findFirst({
                    where: {
                        userId: userId
                    }
                })

                const transferData = JSON.parse(db_data?.data!);
                const userAuth = await prisma.userAuth.findUnique({ where: { userId } });
     
                if (!userAuth) {
                    await resetUserState(userId);
                    return ctx.reply("You are not logged in. Use /login to authenticate.");
                }

                const { token, address, amount } = transferData;
                let tokenAddress = token === "USDC" ? "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" : "";

                const res = await do_transfer(userAuth.authToken, address, amount, tokenAddress);
                await prisma.current_process.delete({
                    where: {
                        id: db_data?.id!
                    }
                })
                if (res.statusCode === 200) {
                    const data = await res.body.json();
                    console.log(data);
                    await resetUserState(userId);
                    return ctx.reply("Transfer successful!");
                } else {
                    await resetUserState(userId);
                    return ctx.reply("Transfer failed. Please try again /transfer");
                }
            }
        }
    }

    if (context.command === "swap") {
        switch (stage) {
            case "from_token": {
                const fromToken = ctx.message.text.toUpperCase();
    
                if (!["USDC", "ETH", "DAI"].includes(fromToken)) {
                    return ctx.reply("Invalid token. Please enter a valid token name (e.g., USDC, ETH, DAI):");
                }
    
                await prisma.current_process.create({
                    data: {
                        userId: userId,
                        data: JSON.stringify({
                            fromToken
                        })
                    }
                });
    
                await updateUserState(userId, {
                    stage: "to_token",
                    context: { ...context, sub_command: "to_token" },
                });
    
                return ctx.reply("Enter the token you want to swap to (e.g., USDC, ETH, DAI):");
            }
            case "to_token": {
                const toToken = ctx.message.text.toUpperCase();
    
                if (!["USDC", "ETH", "DAI"].includes(toToken)) {
                    return ctx.reply("Invalid token. Please enter a valid token name (e.g., USDC, ETH, DAI):");
                }
    
                const existingData = await prisma.current_process.findFirst({
                    where: {
                        userId: userId
                    }
                });
    
                await prisma.current_process.update({
                    where: {
                        id: existingData?.id!
                    },
                    data: {
                        data: {
                            set: JSON.stringify({
                                ...JSON.parse(existingData?.data!),
                                toToken
                            })
                        }
                    }
                });
    
                await updateUserState(userId, {
                    stage: "amount",
                    context: { ...context, sub_command: "amount" },
                });
    
                return ctx.reply(`You want to swap to ${toToken}. Now enter the amount you want to swap:`);
            }
            case "amount": {
                const amount = parseFloat(ctx.message.text);
    
                if (isNaN(amount) || amount <= 0) {
                    return ctx.reply("Invalid amount. Please enter a valid number:");
                }
    
                const existingData = await prisma.current_process.findFirst({
                    where: {
                        userId: userId
                    }
                });
    
                await prisma.current_process.update({
                    where: {
                        id: existingData?.id!
                    },
                    data: {
                        data: {
                            set: JSON.stringify({
                                ...JSON.parse(existingData?.data!),
                                amount
                            })
                        }
                    }
                });
    
                await updateUserState(userId, {
                    stage: "confirmation",
                    context: { ...context, sub_command: "confirmation" },
                });
    
                const data = JSON.parse(existingData?.data!);
                return ctx.reply(
                    `You are swapping ${amount} ${data.fromToken} to ${data.toToken}.\n\nConfirm? (yes/no)`
                );
            }
            case "confirmation": {
                const confirmation = ctx.message.text.toLowerCase();
    
                if (confirmation !== "yes" && confirmation !== "no") {
                    return ctx.reply('Please type "yes" to confirm or "no" to cancel.');
                }
    
                if (confirmation === "no") {
                    await resetUserState(userId);
                    return ctx.reply("Swap canceled. Use /swap to start again.");
                }
    
                const db_data = await prisma.current_process.findFirst({
                    where: {
                        userId: userId
                    }
                });
    
                const swapData = JSON.parse(db_data?.data!);
                const userAuth = await prisma.userAuth.findUnique({ where: { userId } });
    
                if (!userAuth) {
                    await resetUserState(userId);
                    return ctx.reply("You are not logged in. Use /login to authenticate.");
                }
    
                const { fromToken, toToken, amount } = swapData;
                const wallet = await get_wallet(userAuth.authToken);

                try {
                    const params = new URLSearchParams({
                        chainId: '8453',
                        fromAddress: wallet,
                        receiver: wallet,
                        spender: wallet,
                        amountIn: (amount * 1_000_000).toString(),
                        slippage: '50',
                        tokenIn: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                        tokenOut: '0x4200000000000000000000000000000000000006',
                        routingStrategy: 'router'
                      });
                  
                      const res = await request(`https://api.enso.finance/api/v1/shortcuts/route?${params}`, {
                        method: 'GET',
                        headers: {
                          'Authorization': 'Bearer 91c8982d-307c-4a5a-9aa6-d3c10adcea21',
                          'Content-Type': 'application/json'
                        }
                      });
                  
                    const data = await res.body.json();
    
                    // @ts-ignore
                    const okto_res = await do_swap(userAuth.authToken, wallet, data.tx.data, data.tx.value)
                    await prisma.current_process.delete({
                        where: {
                            id: db_data?.id!
                        }
                    });
            
                    await resetUserState(userId);
                    if(okto_res.statusCode === 400){
                        ctx.reply("Swap failed. Please try again /swap");
                    } else{
                        ctx.reply("Swap successful!");
                    }

                    // return ctx.reply(
                    //     `Transaction details:\n\n` +
                    //     `From: ${from}\n` +
                    //     `To: ${to}\n` +
                    //     `Data: ${data}\n` +
                    //     `Value: ${value}\n\n` +
                    //     `You can now execute this transaction on-chain.`
                    // );
                } catch (error) {
                    console.error(error);
                    await resetUserState(userId);
                    return ctx.reply("An error occurred during the swap process. Please try again later.");
                }
                
            }
        }
    }
    
})


bot.launch().then(() => console.log("Bot is running!"));
