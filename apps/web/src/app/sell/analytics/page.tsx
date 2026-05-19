"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { ArrowLeft, TrendingUp, Package, DollarSign, ShoppingBag } from "lucide-react";

interface SellerOrder {
  id: string;
  buyer_name: string;
  total_amount: number;
  status: string;
  item_count: number;
  placed_at: string;
}

interface AnalyticsData {
  total_revenue: number;
  total_orders: number;
  pending_orders: number;
  shipped_orders: number;
  recent_orders: SellerOrder[];
}

export default function SellerAnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchAnalytics = async () => {
      try {
        const orders: SellerOrder[] = await apiClient.get<SellerOrder[]>("/seller-orders");
        const totalRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0);
        const totalOrders = orders.length;
        const pendingOrders = orders.filter(
          (o) => o.status === "pending" || o.status === "confirmed"
        ).length;
        const shippedOrders = orders.filter(
          (o) => o.status === "shipped" || o.status === "out_for_delivery" || o.status === "delivered"
        ).length;
        setAnalytics({
          total_revenue: totalRevenue,
          total_orders: totalOrders,
          pending_orders: pendingOrders,
          shipped_orders: shippedOrders,
          recent_orders: orders.slice(0, 10),
        });
      } catch (err: any) {
        toast.error("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Sign in to view analytics</h2>
        <Link
          href="/auth"
          className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold"
        >
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

      <h1 className="text-3xl font-bold text-foreground mb-8">Analytics</h1>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground animate-pulse">
          Crunching numbers...
        </div>
      ) : analytics ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">
                    ${(analytics.total_revenue / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{analytics.total_orders}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{analytics.pending_orders}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Shipped</p>
                  <p className="text-2xl font-bold">{analytics.shipped_orders}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className="border border-border rounded-lg bg-card overflow-x-auto">
            <h2 className="text-xl font-semibold p-5 border-b border-border">
              Recent Orders
            </h2>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Order</th>
                  <th className="p-3 font-medium">Buyer</th>
                  <th className="p-3 font-medium">Items</th>
                  <th className="p-3 font-medium">Total</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics.recent_orders.map((order) => (
                  <tr key={order.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">#{order.id.slice(0, 8)}</td>
                    <td className="p-3">{order.buyer_name}</td>
                    <td className="p-3">{order.item_count}</td>
                    <td className="p-3">${(order.total_amount / 100).toFixed(2)}</td>
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
                {analytics.recent_orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No orders yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-muted-foreground">Unable to load analytics.</div>
      )}
    </div>
  );
}