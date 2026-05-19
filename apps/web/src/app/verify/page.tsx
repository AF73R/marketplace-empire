"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    const verify = async () => {
      try {
        // The backend endpoint is already set up: GET /api/auth/verify?token=...
        await apiClient.get(`/auth/verify?token=${encodeURIComponent(token)}`);
        setStatus("success");
        setMessage("Your email has been verified! You can now enjoy all features of the marketplace.");
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "Verification failed. The token may be invalid or expired.");
      }
    };
    verify();
  }, [token]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      {status === "loading" && (
        <div className="space-y-4">
          <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
          <h1 className="text-2xl font-bold">Verifying your email...</h1>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-4">
          <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
          <h1 className="text-2xl font-bold">Email Verified!</h1>
          <p className="text-muted-foreground">{message}</p>
          <Link
            href="/"
            className="inline-block mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold"
          >
            Go to Marketplace
          </Link>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-4">
          <XCircle className="w-16 h-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold">Verification Failed</h1>
          <p className="text-muted-foreground">{message}</p>
          <Link
            href="/"
            className="inline-block mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold"
          >
            Back to Home
          </Link>
        </div>
      )}
    </div>
  );
}