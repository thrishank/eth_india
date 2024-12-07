import { Context } from "telegraf";
import { getUserState, updateUserState } from "../prisma";
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
    stage: "token_name",
    context: { isAI: false, command: "transfer", sub_command: "token_name" },
  });

  return ctx.reply("Which token would you like to transfer (e.g., USDC, ETH)?");
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
