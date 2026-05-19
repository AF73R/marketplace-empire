"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Star, User, Loader2 } from "lucide-react";
import Link from "next/link";

interface Review {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface ReviewData {
  reviews: Review[];
  average: number;
  total_reviews: number;
}

export function ReviewSection({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  const fetchReviews = async () => {
    try {
      const data = await apiClient.get<ReviewData>(`/reviews/products/${productId}/reviews`);
      const reviewsArray = Array.isArray(data?.reviews) ? data.reviews : [];
      setReviews(reviewsArray);
      setAverage(typeof data?.average === "number" ? data.average : 0);
      setTotal(typeof data?.total_reviews === "number" ? data.total_reviews : 0);
      if (user) {
        setHasReviewed(reviewsArray.some((r) => r.user_id === user.id));
      }
    } catch {
      setReviews([]);
      setAverage(0);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) fetchReviews();
  }, [productId, user]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in to leave a review");
      return;
    }
    if (!comment.trim()) {
      toast.error("Please write a comment");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post(`/reviews/products/${productId}/reviews`, {
        rating,
        comment: comment.trim(),
      });
      toast.success("Review submitted!");
      setComment("");
      setRating(5);
      fetchReviews();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t border-border pt-8 mt-8">
      <h2 className="text-2xl font-bold mb-6">
        Reviews{" "}
        {total > 0 && (
          <span className="text-lg font-normal text-muted-foreground">
            ({total} review{total !== 1 ? "s" : ""})
          </span>
        )}
      </h2>

      {/* Average rating */}
      {!loading && total > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-5 h-5 ${
                  star <= Math.round(average)
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-muted-foreground"
                }`}
              />
            ))}
          </div>
          <span className="text-lg font-semibold">{average.toFixed(1)}</span>
        </div>
      )}

      {/* Existing reviews */}
      {loading ? (
        <div className="py-4 text-center text-muted-foreground">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <p className="text-muted-foreground py-4">No reviews yet. Be the first!</p>
      ) : (
        <div className="space-y-4 mb-8">
          {reviews.map((review) => (
            <div key={review.id} className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="font-medium">{review.user_name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-0.5 ml-auto">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-3.5 h-3.5 ${
                        star <= review.rating
                          ? "text-yellow-500 fill-yellow-500"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-sm text-foreground">{review.comment}</p>
            </div>
          ))}
        </div>
      )}

      {/* Review form */}
      {user && !hasReviewed && (
        <form onSubmit={handleSubmitReview} className="border border-border rounded-lg p-5 bg-card">
          <h3 className="font-semibold mb-3">Leave a Review</h3>
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="focus:outline-none"
              >
                <Star
                  className={`w-6 h-6 transition-colors ${
                    star <= rating
                      ? "text-yellow-500 fill-yellow-500"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your thoughts about this product..."
            className="w-full px-3 py-2 border border-border rounded-md bg-background resize-y mb-3"
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      )}

      {!user && (
        <p className="text-sm text-muted-foreground mt-4">
          <Link href="/auth" className="text-primary hover:underline">
            Sign in
          </Link>{" "}
          to leave a review.
        </p>
      )}
    </div>
  );
}