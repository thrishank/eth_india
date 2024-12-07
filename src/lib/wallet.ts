import { request } from "undici";

export async function get_wallet(token: string){
    if (!token) {
        throw new Error("token not found")
    }
    const res = await request('https://sandbox-api.okto.tech/api/v1/wallet', {
        headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "NextJSDev/1.0",
            Referer: "http://localhost:3000",
        }
    })
    const data = await res.body.json();

    // @ts-ignore
    const base_wallet = data.data.wallets.find((wallet: any) => wallet.network_name === "BASE");
    return base_wallet.address;
}

