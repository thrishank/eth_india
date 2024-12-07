import { request } from "undici";
import { prisma } from "../types/data";
import { Context } from "telegraf";

// Network scanner base URLs
const NETWORK_SCANNERS: { [key: string]: string } = {
    "polygon": "https://polygonscan.com/tx/",
    "base": "https://basescan.org/tx/",
    "default": "#"
};

// Function to get network scanner URL
function getNetworkScannerUrl(networkName: string, transactionHash: string): string {
    const normalizedNetworkName = networkName.toLowerCase();
    const scannerBaseUrl = NETWORK_SCANNERS[normalizedNetworkName] || NETWORK_SCANNERS["default"];
    return `${scannerBaseUrl}${transactionHash}`;
}

// Function to format status with color and emoji
function formatStatus(status: string): string {
    switch (status.toLowerCase()) {
        case "completed":
            return "✅ Completed";
        case "pending":
            return "⏳ Pending";
        case "failed":
            return "❌ Failed";
        default:
            return `ℹ️ ${status}`;
    }
}

export async function history(ctx: Context) {
    const userId = ctx.from!.id.toString();

    const token = await prisma.userAuth.findUnique({
        where: { userId },
    });

    if (!token) {
        return ctx.reply("❗ You are not logged in. Use /login to authenticate.");
    }

    try {
        const res = await request("https://sandbox-api.okto.tech/api/v1/orders", {
            headers: {
                Authorization: `Bearer ${token.authToken}`,
                "User-Agent": "NextJSDev/1.0",
                Referer: "http://localhost:3000",
            },
        });

        const responseBody = await res.body.json();

        //@ts-ignore
        if (responseBody.status !== "success" || !responseBody.data) {
            return ctx.reply("🚫 Unable to fetch history at the moment. Please try again later.");
        }

        //@ts-ignore
        const { jobs } = responseBody.data;

        // Handle empty job history
        if (jobs.length === 0) {
            return ctx.reply("📭 No transaction history found.");
        }

        // Format and display up to 10 recent transactions
        const maxHistory = Math.min(jobs.length, 10);
        const historyMessages = jobs.slice(0, maxHistory).map((job: any, index: number) => {
            const scannerUrl = getNetworkScannerUrl(job.network_name, job.transaction_hash);

            return `
<b>🔢 Order #${index + 1}</b>

<b>🌐 Network:</b> <code>${job.network_name.toUpperCase()}</code>
<b>📊 Status:</b> ${formatStatus(job.status)}
<b>🔗 Transaction:</b> <a href="${scannerUrl}">${truncateHash(job.transaction_hash)}</a>
<b>📅 Created:</b> ${formatDate(job.created_at)}
<b>🕒 Updated:</b> ${formatDate(job.updated_at)}
            `.trim();
        });

        // Send the formatted history as Telegram message
        return ctx.reply(historyMessages.join("\n\n"), {
            parse_mode: "HTML",
        });
    } catch (error) {
        console.error("🔴 Error fetching history:", error);
        return ctx.reply(
            "🚨 An error occurred while fetching your history. Please try again later."
        );
    }
}

// Helper function to truncate transaction hash
function truncateHash(hash: string): string {
    if (!hash) return 'N/A';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

// Helper function to format date
function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}