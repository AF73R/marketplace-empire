"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  Truck,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { apiClient } from "@/lib/api-client";
import type { Product } from "@marketplace/shared-types";
import { ReviewSection } from "@/components/review-section";

export default function ProductDetailPage({ params }: { params: { slug: string } }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [availableStock, setAvailableStock] = useState<number>(0);
  const { addItem } = useCart();

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get<Product>(`/products/${params.slug}`)
      .then((p) => {
        setProduct(p);
        setLoading(false);
        fetchShippingEstimate();
        fetchAvailableStock(p.id);
      })
      .catch(() => {
        setError("Product not found");
        setLoading(false);
      });
  }, [params.slug]);

  const fetchShippingEstimate = async () => {
    try {
      // Correct weight: use the current quantity (minimum 1)
      const data = await apiClient.get<{ cost: number }>(
        `/shipping/cost?country=US&weight=${quantity || 1}&subtotal=${product?.price || 0}`
      );
      setShippingCost(data.cost);
    } catch {
      setShippingCost(null);
    }
  };

  const fetchAvailableStock = async (productId: string) => {
    try {
      const data = await apiClient.get<{ available: number }>(
        `/products/${productId}/stock`
      );
      setAvailableStock(data.available);
    } catch {
      setAvailableStock(0);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-muted-foreground animate-pulse">
        Summoning product...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">Product Not Found</h2>
        <Link href="/products" className="text-primary hover:underline">
          Back to products
        </Link>
      </div>
    );
  }

  const images: string[] = product.images?.length ? product.images : [];
  const currentImage = images.length > 0 ? images[currentImageIdx] : null;

  const handleAddToCart = () => {
    addItem(
      {
        productId: product.id,
        title: product.title,
        slug: product.slug,
        price: product.price,
        image: images.length > 0 ? images[0] : null,
      },
      quantity
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/products"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to products
      </Link>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Image gallery */}
        <div className="space-y-4">
          <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden relative">
            {currentImage ? (
              <img
                src={currentImage}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-6xl text-muted-foreground">🏛️</span>
            )}
            {images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setCurrentImageIdx((prev) =>
                      prev === 0 ? images.length - 1 : prev - 1
                    )
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 text-white rounded-full hover:bg-black/50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() =>
                    setCurrentImageIdx((prev) =>
                      prev === images.length - 1 ? 0 : prev + 1
                    )
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 text-white rounded-full hover:bg-black/50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIdx(idx)}
                  className={`w-16 h-16 border-2 rounded-md overflow-hidden ${
                    idx === currentImageIdx ? "border-primary" : "border-border"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product details */}
        <div className="space-y-6">
          <div>
            <div className="flex gap-2">
              {product.category?.map((cat) => (
                <span key={cat} className="px-2 py-1 bg-muted rounded-full text-xs">
                  {cat}
                </span>
              ))}
            </div>
            <h1 className="text-3xl font-bold mt-2">{product.title}</h1>
            <div className="flex items-center gap-1 mt-2">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="text-sm text-muted-foreground">4.8 (42 reviews)</span>
            </div>
          </div>

          <p className="text-4xl font-extrabold text-primary">
            ${(product.price / 100).toFixed(2)}
          </p>
          <p className="text-muted-foreground leading-relaxed">{product.description}</p>

          {/* ★ Available Stock */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
            <Package className="w-5 h-5 text-primary" />
            {availableStock > 0 ? (
              <span className="text-sm font-medium">{availableStock} in stock</span>
            ) : (
              <span className="text-sm text-destructive">Out of stock</span>
            )}
          </div>

          {/* Dynamic Shipping Cost (correct weight) */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
            <Truck className="w-5 h-5 text-primary" />
            {shippingCost === null ? (
              <span className="text-sm text-muted-foreground">Calculating shipping...</span>
            ) : shippingCost === 0 ? (
              <span className="text-sm">Free shipping</span>
            ) : (
              <span className="text-sm">
                Shipping: ${(shippingCost / 100).toFixed(2)} · 3-5 business days
              </span>
            )}
          </div>

          {/* Quantity + Add to Cart */}
          <div className="flex items-center gap-4">
            <div className="flex items-center border rounded-md">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-2 hover:bg-muted"
                disabled={availableStock === 0}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 min-w-[3rem] text-center font-medium">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="p-2 hover:bg-muted"
                disabled={availableStock === 0}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={availableStock === 0}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-md font-semibold transition-colors ${
                availableStock === 0
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : added
                  ? "bg-green-600 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              {availableStock === 0 ? "Sold Out" : added ? "Added!" : "Add to Cart"}
            </button>
          </div>

          {/* Seller link */}
          <div className="border-t border-border pt-4">
            <Link
              href={`/sellers/${product.seller_id}`}
              className="text-sm text-primary hover:underline"
            >
              View seller's shop
            </Link>
          </div>
        </div>
      </div>

      <ReviewSection productId={product.id} />
    </div>
  );
}