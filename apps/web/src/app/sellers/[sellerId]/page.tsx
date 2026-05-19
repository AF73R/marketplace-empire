"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Store, Calendar, Package, Phone, MapPin } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ProductCard } from "@/components/product-card";

interface SellerInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  avatar_url?: string;
  cover_url?: string;
  created_at: string;
  total_sales: number;
  active_products_count: number;
}

interface Product {
  id: string;
  title: string;
  description?: string;
  slug: string;
  price: number;
  images: string[];
  category: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

export default function SellerProfilePage() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sellerId) return;
    const fetchSeller = async () => {
      try {
        setLoading(true);
        setError(null);
        const [sellerData, sellerProducts] = await Promise.all([
          apiClient.get<SellerInfo>(`/sellers/${sellerId}`),
          apiClient.get<Product[]>(`/sellers/${sellerId}/products`),
        ]);
        setSeller(sellerData);
        setProducts(sellerProducts);
      } catch (err: any) {
        setError(err.message || "Could not load seller");
      } finally {
        setLoading(false);
      }
    };
    fetchSeller();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-muted-foreground animate-pulse">
        Summoning seller profile...
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">Seller Not Found</h2>
        <p className="text-muted-foreground">This shop has vanished into the void.</p>
        <Link
          href="/products"
          className="mt-6 inline-block px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Cover Image */}
      <div className="relative w-full h-48 sm:h-64 rounded-lg bg-muted mb-6 overflow-hidden">
        {seller.cover_url ? (
          <img src={seller.cover_url} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-r from-primary/10 to-primary/5">
            <Store className="w-12 h-12 opacity-40" />
          </div>
        )}
      </div>

      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-12 pb-8 border-b border-border">
        {/* Avatar */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-background -mt-12 sm:-mt-16 overflow-hidden bg-card">
          {seller.avatar_url ? (
            <img src={seller.avatar_url} alt={seller.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-primary bg-primary/20">
              {seller.name.charAt(0)?.toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2 pt-2">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{seller.name}</h1>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Member since {new Date(seller.created_at).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Store className="w-4 h-4" />
              {seller.total_sales} sale{seller.total_sales !== 1 ? "s" : ""}
            </span>
            <span>
              {seller.active_products_count} active product{seller.active_products_count !== 1 ? "s" : ""}
            </span>
          </div>

          {/* ★ Phone and Address */}
          {seller.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span>{seller.phone}</span>
            </div>
          )}
          {seller.address && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{seller.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Products Grid */}
      <h2 className="text-2xl font-bold text-foreground mb-6">Products</h2>
      {products.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">
          This seller has not listed any products yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              title={product.title}
              slug={product.slug}
              price={product.price}
              seller={seller.name}
              image={product.images?.[0]}
            />
          ))}
        </div>
      )}
    </div>
  );
}