import Link from "next/link";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  id: string;
  title: string;
  slug: string;
  price: number; // in cents
  seller: string;
  image?: string | null;
  rating?: number;
  reviewCount?: number;
  className?: string;
}

export function ProductCard({
  title,
  slug,
  price,
  seller,
  image,
  rating,
  reviewCount,
  className,
}: ProductCardProps) {
  return (
    <Link
      href={`/products/${slug}`}
      className={cn(
        "group block rounded-lg border border-border bg-card p-4 hover:shadow-lg transition-shadow",
        className
      )}
    >
      {/* Image */}
      <div className="aspect-square bg-muted rounded-md mb-4 flex items-center justify-center overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-4xl text-muted-foreground">📦</span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
        {title}
      </h3>

      {/* Seller */}
      <p className="text-sm text-muted-foreground mt-1">by {seller}</p>

      {/* Rating */}
      {rating && (
        <div className="flex items-center gap-1 mt-2 text-sm text-yellow-500">
          <Star className="w-3.5 h-3.5 fill-current" />
          <span className="font-medium">{rating.toFixed(1)}</span>
          {reviewCount !== undefined && (
            <span className="text-muted-foreground">({reviewCount})</span>
          )}
        </div>
      )}

      {/* Price */}
      <p className="mt-3 font-bold text-lg">
        ${(price / 100).toFixed(2)}
      </p>
    </Link>
  );
}