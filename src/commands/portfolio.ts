import { request } from "undici";
import { prisma } from "../types/data";
import { Context } from "telegraf";

export async function portfolio(ctx: Context){
    const userId = ctx.from!.id.toString();
    const token = await prisma.userAuth.findUnique({
        where: {
            userId,
        },
    });

    if (!token) {
        return ctx.reply("You are not logged in. Use /login to authenticate.");
    }

    const res = await request("https://sandbox-api.okto.tech/api/v1/portfolio", {
        headers: {
            Authorization: `Bearer ${token?.authToken}`,
            "User-Agent": "NextJSDev/1.0",
            Referer: "http://localhost:3000",
        },
    });

    const data = await res.body.json();

    const formatTokenMessage = (data: any, network: string) => {
        if (data.status !== "success" || !data.data.tokens) {
            return `🔹 No token data available for ${network} network.`;
        }

        interface Token {
            token_name: string;
            quantity: string;
            amount_in_inr: string;
            token_image: string;
            token_address: string;
            network_name: string;
        }

        const tokens = data.data.tokens.filter(
            (token: Token) => token.network_name === network
        );

        if (tokens.length === 0) {
            return `🔹 No tokens found on ${network} network.`;
        }

        const tokenLines = tokens
            .map(
                (token: Token) =>
                    `📊 <b>${token.token_name}</b>\n` +
                    `   Quantity: <code>${token.quantity}</code>\n` +
                    `   Value: ₹<code>${token.amount_in_inr}</code>`
            )
            .join("\n\n");

        return `🔹 Your ${network} Network Tokens:\n\n${tokenLines}`;
    };

    const baseMessage = formatTokenMessage(data, "BASE");
    const polygonMessage = formatTokenMessage(data, "POLYGON");

    ctx.reply(`${baseMessage}\n\n${polygonMessage}`, {
        parse_mode: "HTML",
    });
}