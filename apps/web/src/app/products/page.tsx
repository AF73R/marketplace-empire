"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { ProductCard } from "@/components/product-card";
import { SearchBar } from "@/components/search-bar";
import type { Product } from "@marketplace/shared-types";

function ProductsContent() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("search") || "";
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        if (searchQuery.trim()) {
          // Use Meilisearch if available; fallback to client-side filter
          try {
            const results = await apiClient.get<Product[]>(
              `/search?q=${encodeURIComponent(searchQuery.trim())}&limit=50`
            );
            setProducts(results);
          } catch {
            const all = await apiClient.get<Product[]>("/products");
            const q = searchQuery.toLowerCase();
            const filtered = all.filter(
              (p) =>
                p.title.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q) ||
                p.tags?.some((t) => t.toLowerCase().includes(q))
            );
            setProducts(filtered);
          }
        } else {
          const data = await apiClient.get<Product[]>("/products");
          setProducts(data);
        }
      } catch (err: any) {
        console.error("Failed to fetch products:", err);
        setError("Failed to load products. Is the backend running?");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header with search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {searchQuery ? `Results for "${searchQuery}"` : "All Products"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {searchQuery
              ? `Found ${products.length} item${products.length !== 1 ? "s" : ""}`
              : "Discover unique physical goods from sellers worldwide."}
          </p>
        </div>
        <div className="w-full sm:w-64">
          <SearchBar />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-20 text-muted-foreground animate-pulse">
          Gathering products from the empire...
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-20">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && products.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-xl mb-4">No products found.</p>
          {searchQuery && (
            <Link href="/products" className="text-primary hover:underline">
              Clear search
            </Link>
          )}
        </div>
      )}

      {/* Product Grid */}
      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
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
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20 text-muted-foreground animate-pulse">
          Loading...
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}