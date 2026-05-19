"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  Trash2,
  ShieldAlert,
  Loader2,
  User,
} from "lucide-react";

interface Review {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export default function AdminReviewsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      // We'll extend the backend next to support this endpoint
      const data = await apiClient.get<Review[]>("/admin/reviews");
      setReviews(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (err.status === 404) {
        setError("Admin reviews endpoint not yet available. Backend update needed.");
      } else {
        setError(err.message || "Failed to load reviews");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchAllReviews();
  }, [user]);

  const handleDelete = async (reviewId: string) => {
    if (!confirm("Delete this review? This cannot be undone.")) return;
    try {
      await apiClient.delete(`/admin/reviews/${reviewId}`);
      toast.success("Review deleted");
      fetchAllReviews();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete review");
    }
  };

  if (!user) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <ShieldAlert className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Admin Access Required</h2>
        <Link href="/auth" className="mt-4 inline-block text-primary hover:underline">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Admin Panel
      </Link>

      <h1 className="text-3xl font-bold text-foreground mb-8">All Reviews</h1>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground mt-2">Loading reviews...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchAllReviews} className="mt-2 text-primary hover:underline">
            Retry
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No reviews yet.</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="p-4 border border-border rounded-lg bg-card"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{review.user_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Product ID: {review.product_id.slice(0, 8)} ·{" "}
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= review.rating
                            ? "text-yellow-500 fill-yellow-500"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => handleDelete(review.id)}
                    className="text-destructive hover:underline text-sm flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
              <p className="text-sm text-foreground">{review.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}