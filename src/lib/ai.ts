import { GoogleGenerativeAI } from "@google/generative-ai";

// Ensure you're using environment variables for API keys in production
const genAI = new GoogleGenerativeAI("AIzaSyA6FvmOifed0fo7Ch3qdc7sN34QEA3KE54");

// Define the type for the response
interface CommandResponse {
  command: string;
  data?: {
    address?: string;
    amount?: string;
    token?: string;
    to_token?: string;
    from_token?: string;
    count?: string;
  };
}

// Async function to process user input
export async function processUserInput(userInput: string): Promise<CommandResponse> {
  // Prompt for the model with user input included
  const prompt = `user input : ${userInput}
  Just keep this info in your mind so that you can understand the intent of the user:
  wallet: get the user's address
  portfolio: get the user's portfolio or get all the asserts in the user's wallet
  previous orders: get all the user's previous orders
  previous n orders: get n previous orders of the user
  VERY IMPORTANT: 
  - Respond ONLY with a valid, parseable JSON object
  - Do NOT include any markdown code blocks (no \`\`\`)
  - Do NOT include any text before or after the JSON
  - Ensure the JSON is exactly in the format specified
  Output the JSON object that matches the input intent.
  - If the intent is "login":
    Output: 
    {"command": "login", "data": {}}
  - If the intent is "logout":
    Output:
    {"command": "logout", "data": {}}
  - If the intent is "wallet":
    Output:
    {"command": "wallet", "data": {}}
  - If the intent is "portfolio":
    Output:
    {"command": "portfolio", "data": {}}
  - If the intent is "previous orders":
    Output:
    {"command": "previous orders", "data": {}}
  - If the intent is "previous n orders":
    Output:
    {"command": "previous n orders", "data": {"count":"n"}}
  - If the intent is "transfer":
    Extract the address, amount, and token. Use empty strings for any missing fields.
    Example Output:
    {"command": "transfer", "data": {"address": "<address>", "amount": "<amount>", "token": "<token>"}}
  - If the intent is "swap":
    Extract to_token, from_token, and amount. Use empty strings for any missing fields.
    Example Output:
    {"command": "swap", "data": {"to_token": "<to_token>", "from_token": "<from_token>", "amount": "<amount>"}}
  - If the input doesn't match "transfer" or "swap":
    Output:
    {"command": "invalid"}`;

  try {
    // Generate content
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);

    // Access the text content from the response object
    const text = result.response?.text();

    if (!text) {
      throw new Error("No text content in the response");
    }

    // Clean the response - remove any potential markdown or extra whitespace
    const cleanedText = text
      .trim()
      .replace(/^```json\s*/, "")
      .replace(/```\s*$/, "");

    // Parse the JSON response
    return JSON.parse(cleanedText) as CommandResponse;
  } catch (error) {
    console.error("Error processing input:", error);

    // Attempt to extract JSON manually if the parsing fails
    if (error instanceof SyntaxError && typeof error.message === "string") {
      const match = error.message.match(/{.*}/);
      if (match) {
        return JSON.parse(match[0]) as CommandResponse;
      }
    }

    // Default to invalid command if all else fails
    return { command: "invalid" };
  }
}