"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  ShieldAlert,
  Loader2,
} from "lucide-react";

interface ReturnInfo {
  id: string;
  order_id: string;
  reason: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AdminReturnsPage() {
  const { user } = useAuth();
  const [returns, setReturns] = useState<ReturnInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllReturns = async () => {
    setLoading(true);
    setError(null);
    try {
      // ★ Corrected URL – admin returns are under /api/admin/returns
      const data = await apiClient.get<ReturnInfo[]>("/admin/returns");
      setReturns(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (err.status === 404) {
        setError("Admin returns endpoint not found. Backend update needed.");
      } else {
        setError(err.message || "Failed to load returns");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchAllReturns();
  }, [user]);

  const handleProcess = async (returnId: string, newStatus: "approved" | "rejected") => {
    try {
      // ★ Corrected URL – processing is under /api/admin/returns/{id}/process
      await apiClient.put(`/admin/returns/${returnId}/process`, { status: newStatus });
      toast.success(`Return ${newStatus}`);
      fetchAllReturns();
    } catch (err: any) {
      toast.error(err.message || "Failed to process return");
    }
  };

  if (!user) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <ShieldAlert className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Admin Access Required</h2>
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
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Admin Panel
      </Link>

      <h1 className="text-3xl font-bold text-foreground mb-8">Return Requests</h1>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground mt-2">Loading returns...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchAllReturns} className="mt-2 text-primary hover:underline">
            Retry
          </button>
        </div>
      ) : returns.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No return requests yet.</p>
      ) : (
        <div className="space-y-4">
          {returns.map((ret) => (
            <div
              key={ret.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border rounded-lg bg-card"
            >
              <div className="flex items-start gap-3">
                {statusIcon(ret.status)}
                <div>
                  <p className="font-medium">
                    Order #{ret.order_id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-muted-foreground">Reason: {ret.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Status: <span className="capitalize font-medium">{ret.status}</span> ·{" "}
                    {new Date(ret.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {ret.status === "requested" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleProcess(ret.id, "approved")}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => handleProcess(ret.id, "rejected")}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}