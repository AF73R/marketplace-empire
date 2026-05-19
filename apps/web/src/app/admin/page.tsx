"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  ShieldAlert,
  RefreshCw,
  Trash2,
  BarChart3,
  RefreshCcw,
  UploadCloud,
  Star,
  Settings,
} from "lucide-react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  created_at: string;
}

interface AdminProduct {
  id: string;
  title: string;
  price: number;
  seller: string;
  is_active: boolean;
}

interface AdminOrder {
  id: string;
  user: string;
  total: number;
  status: string;
  payment_method: string;
  created_at: string;
}

const ORDER_STAGES = [
  "pending",
  "confirmed",
  "shipped",
  "out_for_delivery",
  "delivered",
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setStatusCode(null);
    try {
      const [u, p, o] = await Promise.all([
        apiClient.get<AdminUser[]>("/admin/users"),
        apiClient.get<AdminProduct[]>("/admin/products"),
        apiClient.get<AdminOrder[]>("/admin/orders"),
      ]);
      setUsers(u);
      setProducts(p);
      setOrders(o);
    } catch (err: any) {
      console.error("Admin fetch error:", err);
      let message = err.message || "Unknown error";
      let code = err.status || null;
      setStatusCode(code);
      if (code === 403) {
        message =
          "Access Denied – your account does not have administrator privileges. Promote yourself to admin via the database.";
      } else if (code === 401) {
        message =
          "Unauthorized – your session may have expired. Please sign in again.";
      }
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setError("You must be signed in to view this page.");
      return;
    }
    fetchData();
  }, [user]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await apiClient.put(`/admin/orders/${orderId}/status`, {
        status: newStatus,
      });
      toast.success(`Order #${orderId.slice(0, 8)} → ${newStatus}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update order");
    }
  };

  const toggleProductActive = async (productId: string, current: boolean) => {
    try {
      await apiClient.put(`/admin/products/${productId}`, {
        is_active: !current,
      });
      toast.success(
        `Product ${productId.slice(0, 8)} ${!current ? "activated" : "deactivated"}`
      );
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update product");
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Delete this user and all their data?")) return;
    try {
      await apiClient.delete(`/admin/users/${userId}`);
      toast.success("User deleted");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const userCount = users?.length ?? 0;
  const productCount = products?.length ?? 0;
  const orderCount = orders?.length ?? 0;

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <ShieldAlert className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-4">Admin Access</h2>
        <p className="text-muted-foreground mb-6">
          You must be signed in to view this page.
        </p>
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top Navigation Bar for Admin Sections */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-8 p-2 bg-muted/30 rounded-lg border">
        <Link
          href="/admin"
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground shadow"
        >
          Dashboard
        </Link>
        <Link
          href="/admin/analytics"
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
        >
          <BarChart3 className="w-4 h-4" /> Analytics
        </Link>
        <Link
          href="/admin/returns"
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
        >
          <RefreshCcw className="w-4 h-4" /> Returns
        </Link>
        <Link
          href="/admin/bulk"
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
        >
          <UploadCloud className="w-4 h-4" /> Bulk
        </Link>
        <Link
          href="/admin/reviews"
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
        >
          <Star className="w-4 h-4" /> Reviews
        </Link>
        <Link
          href="/admin/settings"
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
        >
          <Settings className="w-4 h-4" /> Settings
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-destructive" />
          <h1 className="text-3xl font-bold text-foreground">
            Admin Control Panel
          </h1>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground animate-pulse">
          Summoning all records...
        </div>
      ) : error ? (
        <div className="text-center py-16 max-w-lg mx-auto">
          <ShieldAlert className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2">Error Loading Admin Data</h2>
          <p className="text-muted-foreground whitespace-pre-wrap">{error}</p>
          {statusCode && (
            <p className="text-sm text-muted-foreground mt-1">
              HTTP Status: {statusCode}
            </p>
          )}
          {statusCode === 403 && (
            <div className="mt-6 p-4 bg-muted rounded-md text-sm text-left">
              <p className="font-semibold mb-2">How to become an admin:</p>
              <code className="text-xs block bg-black text-green-400 p-2 rounded">
                docker exec -it marketplace-postgres psql -U market -d
                marketplace -c "UPDATE users SET is_admin = true WHERE email =
                '{user.email}';"
              </code>
              <p className="mt-2">
                Then sign out and back in.
              </p>
            </div>
          )}
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Users */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">
              Users ({userCount})
            </h2>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Address</th>
                    <th className="p-3">Joined</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(users ?? []).map((u) => (
                    <tr key={u.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">{u.name}</td>
                      <td className="p-3 text-muted-foreground">{u.email}</td>
                      <td className="p-3 text-muted-foreground">{u.phone || "—"}</td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate">{u.address || "—"}</td>
                      <td className="p-3">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => deleteUser(u.id)}
                          className="text-destructive hover:underline text-xs inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(users ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        No users
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Products */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">
              Products ({productCount})
            </h2>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Title</th>
                    <th className="p-3">Seller</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Active</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(products ?? []).map((p) => (
                    <tr key={p.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">{p.title}</td>
                      <td className="p-3 text-muted-foreground">{p.seller}</td>
                      <td className="p-3">${(p.price / 100).toFixed(2)}</td>
                      <td className="p-3">
                        <span className={p.is_active ? "text-green-600" : "text-red-500"}>
                          {p.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => toggleProductActive(p.id, p.is_active)}
                          className="text-primary hover:underline text-xs"
                        >
                          {p.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(products ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        No products
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Orders */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">
              Orders ({orderCount})
            </h2>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {(orders ?? []).map((o) => (
                    <tr key={o.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">
                        #{o.id.slice(0, 8)}
                      </td>
                      <td className="p-3 text-muted-foreground">{o.user}</td>
                      <td className="p-3">${(o.total / 100).toFixed(2)}</td>
                      <td className="p-3">
                        {o.payment_method === "cod" ? "Cash" : "Card"}
                      </td>
                      <td className="p-3 capitalize">
                        {o.status.replace(/_/g, " ")}
                      </td>
                      <td className="p-3 text-right">
                        <select
                          value={o.status}
                          onChange={(e) =>
                            updateOrderStatus(o.id, e.target.value)
                          }
                          className="border rounded px-2 py-1 text-xs bg-background"
                        >
                          {ORDER_STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {(orders ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        No orders
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}