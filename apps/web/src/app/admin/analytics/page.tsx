"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  ShieldAlert,
  TrendingUp,
  Users,
  Package,
  DollarSign,
  BarChart3,
  Loader2,
  CheckCircle,
  RotateCcw,
  Truck,
  Receipt,
} from "lucide-react";
import Link from "next/link";

interface Overview {
  total_users: number;
  total_products: number;
  total_orders: number;
  total_revenue: number; // now subtotal of delivered orders only
  pending_orders: number;
  shipped_orders: number;
  delivered_orders: number;  // new
  returns_count: number;     // new
  total_shipping: number;    // new (cents)
  total_tax: number;         // new (cents)
}

interface RevenueDataPoint {
  date: string;
  revenue: number;
}

interface TopSeller {
  seller_id: string;
  seller_name: string;
  revenue: number;
  order_count: number;
}

export default function AdminAnalyticsPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ov, rev, ts] = await Promise.all([
          apiClient.get<Overview>("/analytics/overview"),
          apiClient.get<RevenueDataPoint[]>("/analytics/revenue"),
          apiClient.get<TopSeller[]>("/analytics/top-sellers"),
        ]);
        setOverview(ov);
        setRevenueData(rev);
        setTopSellers(ts);
      } catch (err: any) {
        setError(err.message || "Failed to load analytics");
        toast.error(err.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <ShieldAlert className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Admin Access Required</h2>
        <Link href="/auth" className="mt-4 inline-block text-primary hover:underline">
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Summoning analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto text-destructive mb-4" />
        <h2 className="text-xl font-bold">Error Loading Analytics</h2>
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
        </div>
        <Link
          href="/admin"
          className="text-sm text-primary hover:underline"
        >
          ← Back to Admin Panel
        </Link>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <Card
          icon={<Users className="w-6 h-6 text-blue-500" />}
          label="Total Users"
          value={overview?.total_users || 0}
        />
        <Card
          icon={<Package className="w-6 h-6 text-green-500" />}
          label="Active Products"
          value={overview?.total_products || 0}
        />
        <Card
          icon={<TrendingUp className="w-6 h-6 text-purple-500" />}
          label="Total Orders"
          value={overview?.total_orders || 0}
        />
        <Card
          icon={<DollarSign className="w-6 h-6 text-amber-500" />}
          label="Total Revenue (Delivered)"
          value={`$${((overview?.total_revenue || 0) / 100).toFixed(2)}`}
        />
        <Card
          icon={<Package className="w-6 h-6 text-orange-500" />}
          label="Pending Orders"
          value={overview?.pending_orders || 0}
        />
        <Card
          icon={<Package className="w-6 h-6 text-teal-500" />}
          label="Shipped Orders"
          value={overview?.shipped_orders || 0}
        />
        {/* New cards */}
        <Card
          icon={<CheckCircle className="w-6 h-6 text-green-600" />}
          label="Delivered Orders"
          value={overview?.delivered_orders || 0}
        />
        <Card
          icon={<RotateCcw className="w-6 h-6 text-red-500" />}
          label="Return Requests"
          value={overview?.returns_count || 0}
        />
        <Card
          icon={<Truck className="w-6 h-6 text-blue-600" />}
          label="Total Shipping (Delivered)"
          value={`$${((overview?.total_shipping || 0) / 100).toFixed(2)}`}
        />
        <Card
          icon={<Receipt className="w-6 h-6 text-yellow-600" />}
          label="Total Tax/VAT (Delivered)"
          value={`$${((overview?.total_tax || 0) / 100).toFixed(2)}`}
        />
      </div>

      {/* Revenue Chart (simple bar) */}
      <div className="border border-border rounded-lg bg-card p-6 mb-10">
        <h2 className="text-xl font-semibold mb-4">Daily Revenue (Last 30 Days)</h2>
        {revenueData.length === 0 ? (
          <p className="text-muted-foreground">No revenue data yet.</p>
        ) : (
          <div className="flex items-end gap-1 h-48 overflow-x-auto">
            {revenueData.map((point) => (
              <div key={point.date} className="flex flex-col items-center min-w-[30px]">
                <span className="text-xs text-muted-foreground mb-1">
                  ${(point.revenue / 100).toFixed(0)}
                </span>
                <div
                  className="w-full bg-primary rounded-t"
                  style={{
                    height: `${Math.min(100, (point.revenue / (Math.max(...revenueData.map(p => p.revenue)) || 1)) * 100)}%`,
                  }}
                />
                <span className="text-xs mt-1 rotate-45 origin-left">
                  {point.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Sellers Table */}
      <div className="border border-border rounded-lg bg-card overflow-x-auto">
        <h2 className="text-xl font-semibold p-5 border-b border-border">Top Sellers</h2>
        {topSellers.length === 0 ? (
          <p className="p-5 text-muted-foreground">No seller data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Seller</th>
                <th className="p-3">Revenue</th>
                <th className="p-3">Orders</th>
              </tr>
            </thead>
            <tbody>
              {topSellers.map((seller) => (
                <tr key={seller.seller_id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 font-medium">{seller.seller_name}</td>
                  <td className="p-3">${(seller.revenue / 100).toFixed(2)}</td>
                  <td className="p-3">{seller.order_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Helper component for overview cards
function Card({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-card">
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}