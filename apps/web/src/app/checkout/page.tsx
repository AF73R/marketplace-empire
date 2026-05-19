"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Loader2, Banknote, CreditCard } from "lucide-react";
import dynamic from "next/dynamic";

const StripePaymentForm = dynamic(
  () => import("@/components/stripe-payment-form"),
  { ssr: false }
);

interface ShippingBreakdown {
  base_cost: number;
  weight_charge: number;
  additional_cost: number;
  total_cost: number;
}

interface TaxInfo {
  tax_amount: number;
  rate: number;
}

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const [address, setAddress] = useState({
    line1: "",
    city: "",
    postal_code: "",
    country: "US",
  });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [loading, setLoading] = useState(false);
  const [taxInfo, setTaxInfo] = useState<TaxInfo | null>(null);
  const [shippingBreakdown, setShippingBreakdown] = useState<ShippingBreakdown | null>(null);

  // Fetch dynamic tax from the backend
  useEffect(() => {
    const fetchTax = async () => {
      try {
        const data = await apiClient.get<TaxInfo>(
          `/tax/calculate?country=${address.country}&subtotal=${subtotal}`
        );
        setTaxInfo(data);
      } catch {
        setTaxInfo(null);
      }
    };
    fetchTax();
  }, [address.country, subtotal]);

  // Fetch live detailed shipping cost when country changes
  useEffect(() => {
    const fetchShipping = async () => {
      try {
        // Correct weight: sum of quantities, minimum 1
        const weight = items.reduce((sum, i) => sum + i.quantity, 0) || 1;
        const data = await apiClient.get<ShippingBreakdown>(
          `/shipping/cost?country=${address.country}&weight=${weight}&subtotal=${subtotal}`
        );
        setShippingBreakdown(data);
      } catch {
        setShippingBreakdown(null);
      }
    };
    fetchShipping();
  }, [address.country, subtotal, items]);

  const shippingTotal = shippingBreakdown?.total_cost ?? 0;
  const taxAmount = taxInfo?.tax_amount ?? 0;
  const taxRate = taxInfo?.rate ?? 0;
  const total = subtotal + shippingTotal + taxAmount;

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Please Sign In</h2>
        <p className="text-muted-foreground mb-6">You must be logged in to place an order.</p>
        <Link href="/auth" className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold">
          Sign In
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Your cart is empty</h2>
        <Link href="/products" className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold">
          Browse Products
        </Link>
      </div>
    );
  }

  const handleStripeSuccess = async (paymentIntentId: string) => {
    setLoading(true);
    try {
      const orderItems = items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
        unit_price: i.price,
        total_price: i.price * i.quantity,
      }));
      await apiClient.post("/orders", {
        items: orderItems,
        shipping_address: address,
        payment_method: "stripe",
      });
      clearCart();
      toast.success("Order placed and paid successfully!");
      router.push("/orders");
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  const handleStripeError = (error: string) => {
    toast.error(error);
  };

  const handleCODSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.line1 || !address.city || !address.postal_code) {
      toast.error("Please complete the shipping address");
      return;
    }
    setLoading(true);
    try {
      const orderItems = items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
        unit_price: i.price,
        total_price: i.price * i.quantity,
      }));
      await apiClient.post("/orders", {
        items: orderItems,
        shipping_address: address,
        payment_method: "cod",
      });
      clearCart();
      toast.success("Order placed successfully!");
      router.push("/orders");
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/cart" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to cart
      </Link>

      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      <div className="space-y-8">
        {/* Shipping Address */}
        <section className="p-6 border border-border rounded-lg bg-card">
          <h2 className="text-xl font-semibold mb-4">Shipping Address</h2>
          <div className="space-y-4">
            <input placeholder="Address Line 1 *" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} className="w-full px-3 py-2 border rounded-md bg-background" required />
            <input placeholder="City *" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className="w-full px-3 py-2 border rounded-md bg-background" required />
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Postal Code *" value={address.postal_code} onChange={(e) => setAddress({ ...address, postal_code: e.target.value })} className="w-full px-3 py-2 border rounded-md bg-background" required />
              <select value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} className="w-full px-3 py-2 border rounded-md bg-background">
                <option value="US">United States</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="UK">United Kingdom</option>
                <option value="BD">Bangladesh</option>
              </select>
            </div>
          </div>
        </section>

        {/* Payment Method */}
        <section className="p-6 border border-border rounded-lg bg-card">
          <h2 className="text-xl font-semibold mb-4">Payment Method</h2>
          <div className="space-y-3 mb-6">
            <label className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer ${paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border"}`}>
              <input type="radio" name="payment" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} className="accent-primary" />
              <Banknote className="w-5 h-5 text-green-600" />
              <span className="font-medium">Cash on Delivery</span>
            </label>
            <label className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer ${paymentMethod === "stripe" ? "border-primary bg-primary/5" : "border-border"}`}>
              <input type="radio" name="payment" value="stripe" checked={paymentMethod === "stripe"} onChange={() => setPaymentMethod("stripe")} className="accent-primary" />
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span className="font-medium">Pay with Card (Stripe)</span>
            </label>
          </div>

          {paymentMethod === "stripe" && (
            <StripePaymentForm
              amount={total}
              currency="usd"
              onSuccess={handleStripeSuccess}
              onError={handleStripeError}
            />
          )}

          {paymentMethod === "cod" && (
            <button
              onClick={handleCODSubmit}
              disabled={loading}
              className="w-full py-3 bg-primary text-primary-foreground rounded-md font-bold text-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? "Placing Order..." : `Place Order – $${(total / 100).toFixed(2)}`}
            </button>
          )}
        </section>

        {/* Order Summary with Dynamic Tax & Shipping */}
        <section className="p-6 border border-border rounded-lg bg-card">
          <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>{item.title} × {item.quantity}</span>
                <span>${((item.price * item.quantity) / 100).toFixed(2)}</span>
              </div>
            ))}
            <hr className="border-border" />
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${(subtotal / 100).toFixed(2)}</span>
            </div>

            {/* Detailed shipping breakdown */}
            {shippingBreakdown ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping (base)</span>
                  <span>${(shippingBreakdown.base_cost / 100).toFixed(2)}</span>
                </div>
                {shippingBreakdown.weight_charge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weight charge</span>
                    <span>${(shippingBreakdown.weight_charge / 100).toFixed(2)}</span>
                  </div>
                )}
                {shippingBreakdown.additional_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Additional cost</span>
                    <span>${(shippingBreakdown.additional_cost / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span>Shipping total</span>
                  <span>${(shippingBreakdown.total_cost / 100).toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="text-muted-foreground">Calculating...</span>
              </div>
            )}

            {/* Dynamic tax */}
            {taxInfo ? (
              <div className="flex justify-between">
                <span>Tax ({(taxRate * 100).toFixed(0)}%)</span>
                <span>${(taxAmount / 100).toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span>Tax</span>
                <span className="text-muted-foreground">Calculating...</span>
              </div>
            )}

            <hr className="border-border" />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>${(total / 100).toFixed(2)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}