
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface CartSummaryItem {
  label: string;
  quantity?: number;
  amount: number; // in cents
}

interface CartSummaryProps {
  items: CartSummaryItem[];
  subtotal: number;
  shipping: number; // in cents
  total: number;
  checkoutUrl?: string;
  className?: string;
}

export function CartSummary({
  items,
  subtotal,
  shipping,
  total,
  checkoutUrl = "/checkout",
  className,
}: CartSummaryProps) {
  return (
    <div
      className={cn(
        "p-4 border border-border rounded-lg bg-card w-full",
        className
      )}
    >
      <h3 className="font-semibold text-lg text-foreground mb-3">Order Summary</h3>

      {items.length > 0 && (
        <ul className="space-y-1 text-sm text-muted-foreground mb-3">
          {items.map((item, idx) => (
            <li key={idx} className="flex justify-between">
              <span>
                {item.label}
                {item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ""}
              </span>
              <span className="font-medium">
                ${(item.amount / 100).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-border pt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="font-medium">${(subtotal / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Shipping</span>
          <span className="font-medium">
            {shipping === 0 ? "Free" : `$${(shipping / 100).toFixed(2)}`}
          </span>
        </div>
        <hr className="border-border my-2" />
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>${(total / 100).toFixed(2)}</span>
        </div>
      </div>

      {checkoutUrl && (
        <Link
          href={checkoutUrl}
          className="mt-4 block w-full text-center px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors"
        >
          Proceed to Checkout
        </Link>
      )}
    </div>
  );
}