"use client";

import { useState, useEffect } from "react";
import { loadStripe, StripeCardElement } from "@stripe/stripe-js";
import { Elements, useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Loader2, CreditCard, Lock } from "lucide-react";

// Initialize Stripe outside of component render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

interface StripePaymentFormProps {
  amount: number;        // in cents
  currency?: string;     // e.g., "usd"
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

// ─── Inner form (inside Elements) ────────────────────────────────────
function StripeForm({ amount, currency = "usd", onSuccess, onError }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      onError("Stripe is not initialized");
      return;
    }

    setLoading(true);
    setCardError(null);

    try {
      // 1. Create PaymentIntent on the backend
      const { client_secret } = await apiClient.post<{ client_secret: string }>(
        "/payment/create-intent",
        { amount, currency }
      );

      // 2. Confirm the card payment
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      const result = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (result.error) {
        setCardError(result.error.message || "Payment failed");
        onError(result.error.message || "Payment failed");
      } else if (result.paymentIntent?.status === "succeeded") {
        toast.success("Payment successful!");
        onSuccess(result.paymentIntent.id);
      }
    } catch (err: any) {
      const msg = err.message || "Payment failed";
      setCardError(msg);
      onError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border border-border rounded-md bg-muted/20">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#1a1a1a",
                "::placeholder": { color: "#aab7c4" },
              },
              invalid: {
                color: "#e53e3e",
              },
            },
          }}
        />
      </div>

      {cardError && (
        <p className="text-sm text-destructive">{cardError}</p>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-3 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Lock className="w-4 h-4" />
        )}
        {loading ? "Processing..." : `Pay $${(amount / 100).toFixed(2)}`}
      </button>
    </form>
  );
}

// ─── Outer wrapper with Stripe Elements ──────────────────────────────
export default function StripePaymentForm({
  amount,
  currency = "usd",
  onSuccess,
  onError,
}: StripePaymentFormProps) {
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Stripe is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your .env file.</p>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        appearance: { theme: "stripe" },
      }}
    >
      <StripeForm amount={amount} currency={currency} onSuccess={onSuccess} onError={onError} />
    </Elements>
  );
}