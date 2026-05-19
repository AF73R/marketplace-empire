// ─── Chat / AI types ────────────────────────────────────────────────

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  messages: Array<{
    role: ChatRole;
    content: string;
  }>;
  context?: {
    product_id?: string;
    order_id?: string;
    page?: "product_detail" | "cart" | "checkout" | "order" | "home" | "sell";
  };
}

export interface ChatResponse {
  reply: string;
  sources?: Array<{
    type: "product" | "order" | "policy";
    label: string;
    url?: string;
  }>;
}