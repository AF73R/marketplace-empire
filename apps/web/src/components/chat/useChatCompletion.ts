"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "@marketplace/shared-types";

// ─── Configuration ──────────────────────────────────────────────────
const API_URL = "/api/chat";
const MAX_RETRIES = 1;

// ─── Hook Interface ─────────────────────────────────────────────────
interface UseChatCompletionReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

export function useChatCompletion(): UseChatCompletionReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "system-welcome",
      role: "assistant",
      content: "Hi! I'm Market-GPT, your shopping assistant. How can I help you today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: "system-welcome",
        role: "assistant",
        content: "Chat cleared. How can I assist you now?",
        timestamp: new Date().toISOString(),
      },
    ]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Abort any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Create user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [...messages.slice(1), userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            context: {}, // optionally pass page context
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        // Handle streaming response (SSE)
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/event-stream")) {
          const reader = response.body?.getReader();
          if (!reader) throw new Error("No response body");

          const decoder = new TextDecoder();
          let assistantContent = "";
          let partial = "";

          // Add an empty assistant message placeholder to update incrementally
          const assistantMessageId = crypto.randomUUID();
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: "assistant",
              content: "",
              timestamp: new Date().toISOString(),
            },
          ]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            partial += decoder.decode(value, { stream: true });
            const lines = partial.split("\n");
            partial = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const contentChunk = parsed.choices?.[0]?.delta?.content;
                if (contentChunk) {
                  assistantContent += contentChunk;
                  // Update the last assistant message with accumulated content
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: assistantContent }
                        : m
                    )
                  );
                }
              } catch {
                // Ignore unparseable lines
              }
            }
          }
        } else {
          // Fallback: non-streaming
          const data = await response.json();
          const reply = data.reply || "I'm sorry, I couldn't process that.";
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: reply,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // ignore abort errors
        console.error("Chat request failed:", err);
        setError("Failed to get response. Please try again.");
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "I'm having trouble responding right now. Please try again.",
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [messages]
  );

  return { messages, isLoading, error, sendMessage, clearMessages };
}