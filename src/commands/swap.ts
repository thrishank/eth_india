import { request } from "undici";

export async function do_swap(
    auth_token: string,
    wallet: string,
    data: string,
    value: string
  ) {
    try {
      const res = await request(
        "https://sandbox-api.okto.tech/api/v1/rawtransaction/execute",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${auth_token}`,
            "Content-Type": "application/json",
            "User-Agent": "NextJSDev/1.0",
            Referer: "http://localhost:3000",
          },
          body: JSON.stringify({
            network_name: 'BASE',
            transaction: {
              from: wallet,
              to: wallet,
              data: data,
              value: value
            }
          })
        }
      );
      const body = await res.body.json();
      console.log(body);
      return res;
    } catch (error) {
      console.error("Transfer API Error:", error);
      throw error;
    }
  }