"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { XCircle, Loader2 } from "lucide-react";

interface CancelOrderButtonProps {
  orderId: string;
  currentStatus: string;
}

const CANCELABLE_STATUSES = ["pending", "confirmed"];

export function CancelOrderButton({ orderId, currentStatus }: CancelOrderButtonProps) {
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const router = useRouter();

  if (!CANCELABLE_STATUSES.includes(currentStatus) || cancelled) return null;

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this order? This action cannot be undone.")) return;
    setLoading(true);
    try {
      await apiClient.post(`/orders/${orderId}/cancel`);
      setCancelled(true);
      toast.success("Order cancelled successfully");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 border border-destructive text-destructive rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors text-sm font-medium disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
      {loading ? "Cancelling..." : "Cancel Order"}
    </button>
  );
}