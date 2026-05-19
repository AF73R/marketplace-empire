"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface OrderStatusUpdate {
  order_id: string;
  status: string;
}

type MessageHandler = (update: OrderStatusUpdate) => void;

export function useWebSocket(onOrderStatus?: MessageHandler) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    // Determine correct WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host; // includes port (e.g., localhost:3000)
    // In dev, the Next.js server runs on 3000, but the Go backend runs on 8080.
    // We'll connect directly to the Go server (port 8080) to avoid proxy issues.
    const wsUrl = `${protocol}://${host.replace(":3000", ":8080")}/ws`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "order-status" && onOrderStatus) {
          onOrderStatus(msg.payload as OrderStatusUpdate);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Reconnect after 3 seconds
      reconnectTimeout.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [onOrderStatus]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return { isConnected };
}