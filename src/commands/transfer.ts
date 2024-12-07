import { Context } from "telegraf";
import { getUserState, updateUserState } from "../lib/prisma";
import { request } from "undici";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function transfer(ctx: Context) {
  const userId = ctx.from!.id.toString();

  const { stage, context } = await getUserState(userId);

  if (stage !== "neutral") {
    return ctx.reply(
      "You are already in the middle of another process. Use /cancel to reset the current flow."
    );
  }

  await updateUserState(userId, {
    stage: "network",
    context: { isAI: false, command: "transfer", sub_command: "network" },
  });

  return ctx.reply("On which network do you want to transfer tokens? i.e.(BASE, POLYGON) etc.");
}

export async function do_transfer(
  auth_token: string,
  address: string,
  amount: number,
  token?: string
) {
  try {
    const res = await request(
      "https://sandbox-api.okto.tech/api/v1/transfer/tokens/execute",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth_token}`,
          "Content-Type": "application/json",
          "User-Agent": "NextJSDev/1.0",
          Referer: "http://localhost:3000",
        },
        body: JSON.stringify({
          network_name: "BASE",
          token_address: token,
          quantity: amount.toString(),
          recipient_address: address,
        }),
      }
    );
    return res;
  } catch (error) {
    console.error("Transfer API Error:", error);
    throw error;
  }
}


export async function fetchOrderStatus(orderId: string, token: string){
    try {
        const response = await request(`https://sandbox-api.okto.tech/api/v1/orders?order_id=${orderId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "NextJSDev/1.0",
            Referer: "http://localhost:3000",
          }
        });
 
        const data = await response.body.json(); 
         
        // @ts-ignore
        return data.data.jobs[0].status;
    } catch (error) {
        console.error("Error fetching order status:", error);
        throw error;
    }
}

export const pollOrderStatus = async (orderId: string, authToken: string, interval = 5000, maxRetries = 20) => {
  let retries = 0;

  while (retries < maxRetries) {
      try {
          const status = await fetchOrderStatus(orderId, authToken);
          console.log("Transfer status:", status);
          if (status === "SUCCESS") {
              console.log("Transfer successful!");
              return status;
          } else if (status === "PENDING" || status === "WAITING_INITIALIZATION" || status === "SUBMITTED" || status === "RUNNING" || status === "WAITING_FOR_SIGNATURE") {
              console.log("Transfer still in progress...");
          } else {
              console.warn("Unexpected status:", status);
              return status;
          }

          // Wait for the polling interval before the next attempt
          await new Promise((resolve) => setTimeout(resolve, interval));
          retries++;
      } catch (error) {
          console.error("Polling error:", error);
          return null; // Exit on error
      }
  }

  console.warn("Max retries reached. Transfer status might still be in progress.");
  return "PENDING";
};