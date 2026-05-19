"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag, Store, TrendingUp } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@marketplace/shared-types";

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<Product[]>("/products")
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-background py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
                Buy & Sell{" "}
                <span className="text-primary">Physical Goods</span>
                <br />
                Like Never Before
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                A divine marketplace where creators meet customers. AI‑powered
                recommendations, lightning‑fast checkout, and seller tools that
                turn your passion into profit.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
                >
                  <ShoppingBag className="w-5 h-5" />
                  Shop Now
                </Link>
                <Link
                  href="/sell"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-border bg-background text-foreground font-semibold hover:bg-muted transition-colors"
                >
                  <Store className="w-5 h-5" />
                  Start Selling
                </Link>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <div className="relative w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
              <div className="absolute text-8xl select-none animate-pulse">
                🏛️
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Products */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-primary" />
                Trending Now
              </h2>
              <p className="text-muted-foreground mt-2">
                {loading ? "Summoning products..." : `${products.length} items ready for you`}
              </p>
            </div>
            <Link
              href="/products"
              className="hidden sm:flex items-center gap-2 text-primary font-medium hover:underline"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-card p-4 animate-pulse"
                  >
                    <div className="aspect-square bg-muted rounded-md mb-4" />
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2 mb-3" />
                    <div className="h-5 bg-muted rounded w-1/3" />
                  </div>
                ))
              : products.slice(0, 8).map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    title={product.title}
                    slug={product.slug}
                    price={product.price}
                    seller={product.seller_id ?? "Unknown"}
                    image={product.images?.[0] ?? null}
                  />
                ))}
          </div>

          {!loading && products.length === 0 && (
            <div className="text-center py-16">
              <p className="text-xl text-muted-foreground">No products yet. Be the first seller!</p>
              <Link
                href="/sell"
                className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold"
              >
                Start Selling
              </Link>
            </div>
          )}

          <div className="mt-10 text-center sm:hidden">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-border font-semibold hover:bg-muted transition-colors"
            >
              View All Products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Seller CTA */}
      <section className="bg-muted/50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Store className="w-12 h-12 mx-auto text-primary mb-6" />
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
            Become a Seller
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            List your physical products, reach thousands of customers, and let our
            AI chatbot guide your pricing, descriptions, and inventory strategy.
          </p>
          <Link
            href="/sell"
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-md bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-colors"
          >
            Open Your Store <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}