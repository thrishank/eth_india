import { Telegraf } from "telegraf";
import { login, login_okto, verify_login_otp } from "./commands/login";
import { getUserState, resetUserState, saveTokens, updateUserState } from "./prisma";
import { APIResponse } from "./types/type";
import { PrismaClient } from "@prisma/client";
import { do_transfer, transfer } from "./commands/transfer";
import { request } from "undici";

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

    const data = await res.body.json();

    // @ts-ignore
    const base_wallet = data.data.wallets.find((wallet: any) => wallet.network_name === "BASE");

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

bot.command("cancel", async (ctx) => {
    const userId = ctx.from.id.toString();

    await resetUserState(userId);
    const existingData = await prisma.token.findMany({
        where: {
            userId
        }
    })
    for (const data of existingData) {
        await prisma.token.delete({
            where: {
                id: data.id
            }
        })
    }
    const existingProcess = await prisma.current_process.findMany({
        where: {
            userId
        }
    })
    for (const data of existingProcess) {
        await prisma.current_process.delete({
            where: {
                id: data.id
            }
        })
    }

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
        // Process message with AI
        const user_prompt = ctx.message.text;

        // return ctx.reply("Processing with AI...");
        // const ai_res = call_ai(user_prompt);
        //ctx.reply(ai_res);
        ctx.reply("Hello from AI");
    }

    const user_name = ctx.from.username;
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
                        userId: user_name!,
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
                    userId: user_name!
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
                    context: { ...context, sub_command: "receiver_address", }
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
})


bot.launch().then(() => console.log("Bot is running!"));
