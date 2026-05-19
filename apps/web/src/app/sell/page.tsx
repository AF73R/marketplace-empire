"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Box,
  DollarSign,
  Package,
  PlusCircle,
  ShoppingBag,
  CheckCircle,
  RotateCcw,
} from "lucide-react";

interface SellerStats {
  total_revenue: number;
  active_products: number;
  orders_pending: number;
  orders_shipped: number;
  orders_delivered: number;
  return_count: number;
}

interface Product {
  id: string;
  title: string;
  slug: string;
  price: number;
  is_active: boolean;
}

interface SellerOrder {
  id: string;
  buyer_name: string;
  total_amount: number;
  subtotal: number;
  status: string;
  item_count: number;
  placed_at: string;
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchDashboard = async () => {
      setError(null);
      try {
        // Products
        let myProducts: Product[] = [];
        try {
          myProducts = await apiClient.get<Product[]>("/products/my");
        } catch (e: any) {
          throw new Error(`Failed to load products: ${e.message}`);
        }
        setProducts(myProducts);

        // Orders (for stats)
        let orders: SellerOrder[] = [];
        try {
          const ordersResp = await apiClient.get<SellerOrder[]>("/seller-orders");
          if (Array.isArray(ordersResp)) {
            orders = ordersResp;
          } else if (ordersResp && typeof ordersResp === "object" && Array.isArray((ordersResp as any).orders)) {
            orders = (ordersResp as any).orders;
          } else {
            orders = [];
          }
        } catch (e: any) {
          throw new Error(`Failed to load orders: ${e.message}`);
        }

        // Count delivered orders
        const deliveredCount = orders.filter(o => o.status === "delivered").length;

        // Return count from the new endpoint
        let returnCount = 0;
        try {
          const rc = await apiClient.get<{ count: number }>("/seller-returns/count");
          returnCount = rc.count || 0;
        } catch {
          // endpoint not mounted yet; ignore
        }

        let revenue = 0;
        let pending = 0;
        let shipped = 0;
        orders.forEach((o) => {
          if (o.status === "delivered") {
            revenue += o.subtotal || 0;
          }
          if (o.status === "pending" || o.status === "confirmed") pending++;
          if (o.status === "shipped" || o.status === "out_for_delivery" || o.status === "delivered") shipped++;
        });

        setStats({
          total_revenue: revenue,
          active_products: myProducts.filter((p) => p.is_active).length,
          orders_pending: pending,
          orders_shipped: shipped,
          orders_delivered: deliveredCount,
          return_count: returnCount,
        });
      } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Sign in to manage your store</h2>
        <Link href="/auth" className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to store
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Seller Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {user.name}!</p>
        </div>
        <Link
          href="/sell/products/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
        >
          <PlusCircle className="w-5 h-5" /> New Product
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground animate-pulse">
          Gathering your empire...
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-2 font-semibold">Error loading dashboard</p>
          <p className="text-sm text-muted-foreground bg-muted p-3 rounded max-w-lg mx-auto whitespace-pre-wrap">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold">Retry</button>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold">${((stats?.total_revenue || 0) / 100).toFixed(2)}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <Box className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Active Products</p>
                  <p className="text-2xl font-bold">{stats?.active_products || 0}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Pending Orders</p>
                  <p className="text-2xl font-bold">{stats?.orders_pending || 0}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Shipped</p>
                  <p className="text-2xl font-bold">{stats?.orders_shipped || 0}</p>
                </div>
              </div>
            </div>
            {/* Delivered & Returns cards */}
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Delivered Orders</p>
                  <p className="text-2xl font-bold">{stats?.orders_delivered || 0}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <RotateCcw className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Return Requests</p>
                  <p className="text-2xl font-bold">{stats?.return_count || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links: Delivered & Returns */}
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            <Link
              href="/sell/orders?status=delivered"
              className="p-4 border border-border rounded-lg bg-card hover:shadow-md transition-shadow flex items-center gap-3"
            >
              <CheckCircle className="w-6 h-6 text-green-500" />
              <div>
                <p className="font-semibold">View Delivered Orders</p>
                <p className="text-sm text-muted-foreground">See completed sales</p>
              </div>
            </Link>
            <Link
              href="/sell/returns"
              className="p-4 border border-border rounded-lg bg-card hover:shadow-md transition-shadow flex items-center gap-3"
            >
              <RotateCcw className="w-6 h-6 text-orange-500" />
              <div>
                <p className="font-semibold">View Return Requests</p>
                <p className="text-sm text-muted-foreground">Manage approved returns</p>
              </div>
            </Link>
          </div>

          {/* Products Table */}
          <div className="border border-border rounded-lg bg-card overflow-x-auto">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Products</h2>
              <Link href="/sell/products" className="text-sm text-primary hover:underline">View all</Link>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Product</th>
                  <th className="p-3 font-medium">Price</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      No products yet. <Link href="/sell/products/new" className="text-primary hover:underline">Create your first product</Link>
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 font-medium text-foreground">{product.title}</td>
                      <td className="p-3">${(product.price / 100).toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          product.is_active
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3">
                        <Link href={`/sell/products/${product.id}/edit`} className="text-primary hover:underline text-xs font-medium">Edit</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}