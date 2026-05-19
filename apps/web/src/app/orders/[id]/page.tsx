"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PackageCheck, Truck, MapPin, CreditCard, Banknote } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { useWebSocket } from "@/hooks/useWebSocket";
import { CancelOrderButton } from "@/components/cancel-order-button";

const ORDER_STAGES = ["pending", "confirmed", "shipped", "out_for_delivery", "delivered"];
const STAGE_LABELS: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Confirmed",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

interface OrderItem {
  id: string;
  product_id: string;
  product_title: string;
  product_slug: string;   // ★ now available from backend
  product_image?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Shipment {
  carrier: string;
  tracking_number: string;
  label_url: string;
  status: string;
  estimated_delivery: string;
}

interface Order {
  id: string;
  status: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount: number;
  currency: string;
  shipping_address: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country: string;
  };
  payment_method: string;
  items: OrderItem[];
  shipment?: Shipment;
  created_at: string;
  updated_at: string;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) {
      setLoading(false);
      return;
    }
    apiClient
      .get<Order>(`/orders/${id}`)
      .then((o) => {
        setOrder(o);
        setLiveStatus(o.status);
      })
      .catch((err) => setError(err.message || "Order not found"))
      .finally(() => setLoading(false));
  }, [id, user]);

  useWebSocket((update) => {
    if (update.order_id === id) {
      setLiveStatus(update.status);
      if (order) {
        setOrder({ ...order, status: update.status });
      }
    }
  });

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Sign in to view orders</h2>
        <Link href="/auth" className="text-primary hover:underline mt-4 inline-block">
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-muted-foreground animate-pulse">
        Consulting the archives...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Order Not Found</h2>
        <Link href="/orders" className="text-primary hover:underline mt-4 inline-block">
          Back to orders
        </Link>
      </div>
    );
  }

  const currentStatus = liveStatus ?? order.status;
  const currentIdx = ORDER_STAGES.indexOf(currentStatus);
  const isCancelled = currentStatus === "cancelled";

  const computedSubtotal =
    order.subtotal ??
    order.items.reduce((sum, item) => sum + item.total_price, 0);
  const displayedTax =
    order.tax_amount ?? order.total_amount - computedSubtotal;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/orders"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to orders
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Order #{id.slice(0, 8)}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Placed on {new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CancelOrderButton
            orderId={order.id}
            currentStatus={currentStatus}
          />
          <span className="self-start inline-flex items-center gap-2 px-3 py-2 border rounded-full text-sm font-medium">
            {order.payment_method === "cod" ? (
              <Banknote className="w-4 h-4 text-green-600" />
            ) : (
              <CreditCard className="w-4 h-4 text-blue-600" />
            )}
            {order.payment_method === "cod"
              ? "Cash on Delivery"
              : "Card (Stripe)"}
          </span>
        </div>
      </div>

      {/* Progress Tracker */}
      {!isCancelled ? (
        <div className="flex items-center gap-1 sm:gap-2 mb-10 flex-wrap justify-center">
          {ORDER_STAGES.map((stage, idx) => (
            <div key={stage} className="flex items-center gap-1 sm:gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  idx <= currentIdx
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-muted border-border text-muted-foreground"
                }`}
              >
                {idx < currentIdx ? "✓" : idx + 1}
              </div>
              <span
                className={`text-xs sm:text-sm whitespace-nowrap ${
                  idx <= currentIdx
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {STAGE_LABELS[stage]}
              </span>
              {idx < ORDER_STAGES.length - 1 && (
                <div
                  className={`w-4 sm:w-8 h-0.5 ${
                    idx < currentIdx ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center mb-10">
          <span className="px-4 py-2 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-full font-semibold">
            Order Cancelled
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items & Address */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-border rounded-lg bg-card p-5">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <PackageCheck className="w-5 h-5" /> Items
            </h2>
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 py-3 border-t border-border first:border-0"
              >
                <div className="w-16 h-16 bg-muted rounded flex items-center justify-center overflow-hidden">
                  {item.product_image ? (
                    <img
                      src={item.product_image}
                      alt={item.product_title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground">📦</span>
                  )}
                </div>
                <div className="flex-1">
                  <Link
                    href={`/products/${item.product_slug}`}  // ★ use slug
                    className="font-medium hover:text-primary transition-colors"
                  >
                    {item.product_title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Qty: {item.quantity}
                  </p>
                  <p className="text-sm font-semibold">
                    ${(item.total_price / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="border border-border rounded-lg bg-card p-5">
            <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <MapPin className="w-5 h-5" /> Shipping Address
            </h2>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {order.shipping_address.line1}
              </p>
              {order.shipping_address.line2 && (
                <p>{order.shipping_address.line2}</p>
              )}
              <p>
                {order.shipping_address.city},{" "}
                {order.shipping_address.state}{" "}
                {order.shipping_address.postal_code}
              </p>
              <p>{order.shipping_address.country}</p>
            </div>
          </div>
        </div>

        {/* Summary & Tracking */}
        <div className="space-y-4">
          <div className="border border-border rounded-lg bg-card p-5">
            <h2 className="font-semibold text-lg mb-3">Order Total</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${(computedSubtotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${(displayedTax / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span>${(order.total_amount / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {order.shipment && (
            <div className="border border-border rounded-lg bg-card p-5">
              <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <Truck className="w-5 h-5" /> Tracking
              </h2>
              <p className="text-sm">{order.shipment.carrier}</p>
              <p className="text-xs font-mono">
                {order.shipment.tracking_number}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Est. delivery: {order.shipment.estimated_delivery}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}