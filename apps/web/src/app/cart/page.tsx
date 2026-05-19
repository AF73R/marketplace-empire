"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { Minus, Plus, ShoppingBag, Trash2, ArrowLeft } from "lucide-react";
import { apiClient } from "@/lib/api-client";

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

export default function CartPage() {
  const { items, updateQuantity, removeItem, subtotal, itemCount } = useCart();
  const [shippingBreakdown, setShippingBreakdown] = useState<ShippingBreakdown | null>(null);
  const [taxInfo, setTaxInfo] = useState<TaxInfo | null>(null);

  // Fetch shipping estimate whenever subtotal changes
  useEffect(() => {
    if (items.length === 0) {
      setShippingBreakdown(null);
      return;
    }
    const fetchShipping = async () => {
      try {
        const weight = items.reduce((sum, i) => sum + i.quantity, 0) || 1;
        const data = await apiClient.get<ShippingBreakdown>(
          `/shipping/cost?country=US&weight=${weight}&subtotal=${subtotal}`
        );
        setShippingBreakdown(data);
      } catch {
        setShippingBreakdown(null);
      }
    };
    fetchShipping();
  }, [subtotal, items]);

  // Fetch dynamic tax
  useEffect(() => {
    if (items.length === 0) {
      setTaxInfo(null);
      return;
    }
    const fetchTax = async () => {
      try {
        const data = await apiClient.get<TaxInfo>(
          `/tax/calculate?country=US&subtotal=${subtotal}`
        );
        setTaxInfo(data);
      } catch {
        setTaxInfo(null);
      }
    };
    fetchTax();
  }, [subtotal, items]);

  const shippingTotal = shippingBreakdown?.total_cost ?? 0;
  const taxAmount = taxInfo?.tax_amount ?? 0;
  const taxRate = taxInfo?.rate ?? 0;
  const total = subtotal + shippingTotal + taxAmount;

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground mb-6" />
        <h1 className="text-2xl font-bold text-foreground">Your cart is empty</h1>
        <p className="text-muted-foreground mt-2">Add some products to get started.</p>
        <Link
          href="/products"
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-foreground mb-8">Your Cart</h1>

      <div className="grid lg:grid-cols-3 gap-10">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex gap-4 p-4 border border-border rounded-lg bg-card"
            >
              <div className="w-24 h-24 bg-muted rounded-md flex-shrink-0 flex items-center justify-center text-muted-foreground text-sm">
                📦
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <Link
                    href={`/products/${item.slug}`}
                    className="font-semibold text-foreground hover:text-primary transition-colors truncate"
                  >
                    {item.title}
                  </Link>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {item.size && (
                  <p className="text-sm text-muted-foreground mt-1">Size: {item.size}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center border border-border rounded-md">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-2 hover:bg-muted transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-3 py-1 text-center min-w-[2.5rem] text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-2 hover:bg-muted transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="font-semibold">
                    ${((item.price * item.quantity) / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-2"
          >
            <ArrowLeft className="w-3 h-3" /> Continue Shopping
          </Link>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="p-6 border border-border rounded-lg bg-card sticky top-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Subtotal ({itemCount} item{itemCount !== 1 ? "s" : ""})
                </span>
                <span className="font-medium">${(subtotal / 100).toFixed(2)}</span>
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
                  <span className="text-muted-foreground">Shipping</span>
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
                  <span className="text-muted-foreground">Tax</span>
                  <span className="text-muted-foreground">Calculating...</span>
                </div>
              )}

              <hr className="border-border my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${(total / 100).toFixed(2)}</span>
              </div>
            </div>
            <Link
              href="/checkout"
              className="mt-6 block w-full text-center px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors"
            >
              Proceed to Checkout
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}