"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Package } from "lucide-react";

interface ApprovedReturn {
  id: string;
  order_id: string;
  product_id: string;
  product_title: string;
  reason: string;
  quantity: number;
  created_at: string;
}

export default function SellerReturnsPage() {
  const { user } = useAuth();
  const [returns, setReturns] = useState<ApprovedReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchReturns = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.get<ApprovedReturn[]>("/seller-returns");
        setReturns(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message || "Failed to load returns");
      } finally {
        setLoading(false);
      }
    };
    fetchReturns();
  }, [user]);

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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/sell"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <h1 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
        <RotateCcw className="w-8 h-8 text-orange-500" />
        Approved Returns
      </h1>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">Loading returns...</div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-2 text-primary hover:underline">
            Retry
          </button>
        </div>
      ) : returns.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p>No approved returns yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {returns.map((ret) => (
            <div
              key={ret.id}
              className="p-4 border border-border rounded-lg bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <p className="font-medium">{ret.product_title}</p>
                <p className="text-sm text-muted-foreground">
                  Order #{ret.order_id.slice(0, 8)} · Qty: {ret.quantity}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Reason: {ret.reason}
                </p>
                <p className="text-xs text-muted-foreground">
                  Returned: {new Date(ret.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}