import { Context } from "telegraf";
import { getUserState, updateUserState } from "../lib/prisma";
import { request } from "undici";
import { prisma } from "../types/data";

export async function login(ctx: Context) {
  const userId = ctx.from!.id.toString();

  const existingState = await getUserState(userId);

  if (existingState.stage !== "neutral") {
    return ctx.reply(
      "You are already in a different process. Use /cancel to restart or complete the current flow."
    );
  }

  const userAuth = await prisma.userAuth.findUnique({ where: { userId } });
  if(userAuth?.walletCreated === false){
    await create_wallet(userAuth.authToken);
    await prisma.userAuth.update({
      where: { userId },
      data: {
        walletCreated: true
      }
    })
  }

  if (userAuth?.authToken) {
    return ctx.reply("Hello I am your AI assistant. How can I help you today? Your'e already logged in with OKTO");
  }

  // Update state for login flow
  await updateUserState(userId, {
    stage: "email",
    context: { isAI: false, command: "login", sub_command: "email" },
  });

  return ctx.reply("Please enter your email address to begin login:");
}

const OKTO_API_KEY = "50142dbc-b4d4-4577-a4db-7580ac14256c";

export async function login_okto(email: string): Promise<any> {
  const url = "https://sandbox-api.okto.tech/api/v1/authenticate/email";
  try {
    const response = await request(url, {
      method: "POST",
      headers: {
        "X-Api-Key": OKTO_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "NextJSDev/1.0",
        Referer: "http://localhost:3000",
      },
      body: JSON.stringify({ email: email }),
    });
    const data = await response.body.json();
    console.log(data);
    return data;
  } catch (error) {
    console.error("Login API Error:", error);
    throw error;
  }
}

export async function verify_login_otp(
  otp: string,
  token: string,
  email: string,
): Promise<any> {
  const res = await request(
    "https://sandbox-api.okto.tech/api/v1/authenticate/email/verify",
    {
      method: "POST",
      headers: {
        "X-Api-Key": OKTO_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "NextJSDev/1.0",
        Referer: "http://localhost:3000",
      },
      body: JSON.stringify({
        email: email,
        otp: otp,
        token: token,
      }),
    },
  );
  const data = await res.body.json();
  console.log(data);
  return data;
}

export async function create_wallet(token: string) {
  const res = await request('https://sandbox-api.okto.tech/api/v1/wallet', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  return res;

}

export async function getWallet(token: string) {
  const res = await request('https://sandbox-api.okto.tech/api/v1/wallet', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  return res;
}