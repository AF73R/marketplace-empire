import { NextRequest } from "next/server";
import type { ChatRequest, ChatResponse } from "@marketplace/shared-types";

// ─── Configuration ──────────────────────────────────────────────────
const AI_API_KEY = process.env.AI_API_KEY || "ollama";
const AI_MODEL = process.env.AI_MODEL || "llama3.2:3b";
const AI_BASE_URL = process.env.AI_BASE_URL || "http://localhost:11434/v1";
const IS_LOCAL_LLM = AI_API_KEY === "ollama" || AI_BASE_URL.includes("localhost");

// ─── Edge Runtime for fast streaming ────────────────────────────────
export const runtime = "edge";

// ─── System prompt definition ───────────────────────────────────────
const SYSTEM_PROMPT = `You are Market-GPT, an AI shopping assistant for Marketplace Empire, a marketplace for physical goods. Your role is to help users:
- Find products by describing what they need
- Compare items (price, features, materials)
- Answer questions about shipping, returns, and payments
- Provide tips for sellers on listing, pricing, and descriptions
- Guide users through the buying/selling process

Guidelines:
- Be friendly, concise, and helpful.
- If asked about specific products, recommend items that match the description. If you don't know the exact catalog, suggest categories and tell the user to browse.
- Never reveal that you are an AI unless directly asked; focus on the user's request.
- Keep responses under 200 words unless the user asks for detailed information.
- If a question cannot be answered based on the store's context, offer to help with something else.
- Do not generate harmful, illegal, or off-topic content. Stay within shopping/advice boundaries.`;

// ─── POST Handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();

    // Validate input
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages array" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Add system prompt at the beginning
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...body.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Optionally inject context about current page
    if (body.context) {
      const contextNote = buildContextNote(body.context);
      if (contextNote) {
        messages.unshift({ role: "system", content: contextNote });
      }
    }

    // Choose provider based on environment variables
    const isOpenAI = AI_BASE_URL?.includes("api.openai.com") || AI_API_KEY?.startsWith("sk-");
    const provider = isOpenAI ? "openai" : IS_LOCAL_LLM ? "ollama" : "openai";

    // Forward request to AI provider
    const upstreamRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: IS_LOCAL_LLM ? "Bearer ollama" : `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!upstreamRes.ok) {
      const err = await upstreamRes.text();
      console.error("AI upstream error:", upstreamRes.status, err);
      return new Response(
        JSON.stringify({ reply: "I'm having trouble thinking right now. Please try again." }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Stream the response back to the client
    return new Response(upstreamRes.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ reply: "Oops! Something went wrong on our end. Try again." }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────
function buildContextNote(context: ChatRequest["context"]): string | null {
  if (!context) return null;
  switch (context.page) {
    case "product_detail":
      return `The user is currently viewing a product detail page. Provide detailed but concise information about the product if asked. Avoid mentioning unrelated items unless asked.`;
    case "cart":
      return `The user is on the cart page. Help with deciding if the cart items are good, suggest complementary products, or answer shipping/promo questions.`;
    case "checkout":
      return `The user is at checkout. Help with payment/shipping questions. Encourage confidence.`;
    case "order":
      return `The user is viewing an order. Help with order status, return policies, or carrier tracking.`;
    case "sell":
      return `The user is in the seller dashboard. Provide tips on product listings, pricing, SEO descriptions, shipping options, or inventory.`;
    default:
      return null;
  }
}