"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

interface ReturnInfo {
  id: string;
  order_id: string;
  reason: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function ReturnsPage() {
  const { user } = useAuth();
  const [returns, setReturns] = useState<ReturnInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orderIdInput, setOrderIdInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [requesting, setRequesting] = useState(false);

  const fetchReturns = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<ReturnInfo[]>("/returns");
      setReturns(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to load returns");
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [user]);

  const handleRequestReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderIdInput.trim() || !reasonInput.trim()) {
      toast.error("Order ID and reason are required");
      return;
    }
    setRequesting(true);
    try {
      await apiClient.post("/returns", {
        order_id: orderIdInput.trim(),
        reason: reasonInput.trim(),
      });
      toast.success("Return requested!");
      setOrderIdInput("");
      setReasonInput("");
      fetchReturns();
    } catch (err: any) {
      toast.error(err.message || "Failed to request return");
    } finally {
      setRequesting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Sign in to view returns</h2>
        <Link href="/auth" className="mt-4 inline-block text-primary hover:underline">
          Sign In
        </Link>
      </div>
    );
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "requested":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "rejected":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "refunded":
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/orders"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to orders
      </Link>

      <h1 className="text-3xl font-bold text-foreground mb-8">Returns & Refunds</h1>

      {/* Request return form */}
      <div className="p-6 border border-border rounded-lg bg-card mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-primary" /> Request a Return
        </h2>
        <form onSubmit={handleRequestReturn} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Order ID</label>
            <input
              type="text"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              placeholder="Paste the Order ID (from your orders page)"
              className="w-full px-3 py-2 border rounded-md bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reason</label>
            <textarea
              rows={3}
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Describe why you want to return this item..."
              className="w-full px-3 py-2 border rounded-md bg-background resize-y"
              required
            />
          </div>
          <button
            type="submit"
            disabled={requesting}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            {requesting ? "Submitting..." : "Submit Return Request"}
          </button>
        </form>
      </div>

      <div>
        <p className="font-semibold">1. Go to Orders (📦 icon in the header).</p>
        <p className="font-semibold">2. Click on the order you wish to return.</p>
        <p className="font-semibold">3. The URL will be /orders/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.</p>
        <p className="font-semibold">4. Copy the full UUID (the part after /orders/).</p>
        <p className="font-semibold">5. Paste that exact UUID into the “Order ID” field on the Returns page and submit.</p>
      </div>
      <div>
        <p>------------------------------------------------------------------------------------------</p>
      </div>

      {/* My Returns list */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-muted-foreground" /> My Returns
        </h2>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : error ? (
          <div>
            <p className="text-destructive">{error}</p>
            <button onClick={fetchReturns} className="mt-2 text-primary hover:underline">
              Retry
            </button>
          </div>
        ) : returns.length === 0 ? (
          <p className="text-muted-foreground">No return requests yet.</p>
        ) : (
          <div className="space-y-4">
            {returns.map((ret) => (
              <div
                key={ret.id}
                className="p-4 border border-border rounded-lg bg-card flex items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  {statusIcon(ret.status)}
                  <div>
                    <p className="font-medium">Order #{ret.order_id.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">Reason: {ret.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: <span className="capitalize font-medium">{ret.status}</span> ·{" "}
                      {new Date(ret.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}