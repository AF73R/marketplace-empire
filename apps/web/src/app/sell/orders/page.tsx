"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { ArrowLeft, Search } from "lucide-react";

interface SellerOrder {
  id: string;
  buyer_name: string;
  total_amount: number;  // full order total (not used for display)
  subtotal: number;      // seller's items sum – we show this
  status: string;
  item_count: number;
  placed_at: string;
}

export default function SellerOrdersPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") || ""; // e.g., "delivered"

  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    apiClient
      .get<SellerOrder[]>("/seller-orders")
      .then((data) => {
        // Filter client‑side by status if requested
        const filtered = statusFilter
          ? data.filter((o) => o.status === statusFilter)
          : data;
        setOrders(filtered);
      })
      .catch(() => toast.error("Failed to load orders"))
      .finally(() => setLoading(false));
  }, [user, statusFilter]);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Sign in to manage orders</h2>
        <Link href="/auth" className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/sell"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {statusFilter ? `Orders — ${statusFilter}` : "All Orders"}
        </h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search orders..."
            className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground animate-pulse">
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          {statusFilter ? `No ${statusFilter} orders yet.` : "No orders yet."}
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Order</th>
                <th className="p-3 font-medium">Buyer</th>
                <th className="p-3 font-medium">Items</th>
                <th className="p-3 font-medium">Subtotal</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">#{order.id.slice(0, 8)}</td>
                  <td className="p-3">{order.buyer_name}</td>
                  <td className="p-3">{order.item_count}</td>
                  <td className="p-3">${(order.subtotal / 100).toFixed(2)}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                        order.status === "pending"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : order.status === "confirmed"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}