import { request } from "undici";
import { prisma } from "../types/data";
import { Context } from "telegraf";

export async function wallet(ctx:Context){
    const userId = ctx.from!.id.toString();
    const token = await prisma.userAuth.findUnique({
        where: {
            userId,
        },
    });

    if (!token) {
        return ctx.reply("You are not logged in. Use /login to authenticate.");
    }
    const res = await request("https://sandbox-api.okto.tech/api/v1/wallet", {
        headers: {
            Authorization: `Bearer ${token?.authToken}`,
            "User-Agent": "NextJSDev/1.0",
            Referer: "http://localhost:3000",
        },
    });

    const response_data = await res.body.json();

    // @ts-ignore
    const base_wallet = response_data.data.wallets.find(
        (wallet: any) => wallet.network_name === "BASE"
    );
    // @ts-ignore
    const polygon_wallet = response_data.data.wallets.find(
        (wallet: any) => wallet.network_name === "POLYGON"
    );
    const base_address = base_wallet ? base_wallet.address : "Not found";
    const polygon_address = polygon_wallet ? polygon_wallet.address : "Not found";

    ctx.reply(
        `Your wallet addresses are:\n\n` +
        `<b>BASE:</b> <code>${base_address}</code>\n` +
        `<b>POLYGON:</b> <code>${polygon_address}</code>`,
        { parse_mode: "HTML" }
    );
}