"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2, Loader2, UploadCloud, X, Package } from "lucide-react";

interface ProductData {
  id: string;
  title: string;
  description?: string;
  price: number; // cents
  images: string[];
  category: string[];
  tags: string[];
}

export default function EditProductPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState<{ url: string }[]>([]);
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [addStock, setAddStock] = useState("");  // amount to add

  useEffect(() => {
    if (!user || !id) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch product data
        const p = await apiClient.get<ProductData>(`/products/by-id/${id}`);
        setTitle(p.title);
        setDescription(p.description || "");
        setPrice((p.price / 100).toFixed(2));
        setImages((p.images || []).map((url: string) => ({ url })));
        setCategory(p.category?.join(", ") || "");
        setTags(p.tags?.join(", ") || "");

        // Fetch stock
        try {
          const stockResp = await apiClient.get<{ available: number }>(`/products/${id}/stock`);
          setCurrentStock(stockResp.available);
        } catch {
          setCurrentStock(null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load product");
        toast.error("Failed to load product");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  // Upload a single image file and return its URL
  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiClient.post<{ url: string }>("/upload", formData);
    return res.url;
  };

  // Handle file change for a specific slot – now uses an async wrapper so multiple uploads are independent
  const handleFileChange = async (idx: number, file: File | null) => {
    if (!file) return;
    try {
      toast.info("Uploading image...");
      const url = await uploadImage(file);
      setImages((prev) => {
        const updated = [...prev];
        updated[idx] = { url };
        return updated;
      });
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed");
    }
  };

  const addImageSlot = () => {
    if (images.length < 5) setImages([...images, { url: "" }]);
  };
  const removeImageSlot = (idx: number) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price) return toast.error("Title and price required");
    setSaving(true);
    try {
      const payload: any = {
        title,
        description,
        price: Math.round(parseFloat(price) * 100),
        images: images.map((img) => img.url).filter((url) => url.trim() !== ""),
        category: category.split(",").map((c) => c.trim()).filter(Boolean),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      // Add stock if a positive number is entered
      const stockNum = parseInt(addStock, 10);
      if (!isNaN(stockNum) && stockNum > 0) {
        payload.stock = stockNum;
      }

      await apiClient.put(`/products/${id}`, payload);
      toast.success("Product updated");
      router.push("/sell");
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this product?")) return;
    try {
      await apiClient.delete(`/products/${id}`);
      toast.success("Product deleted");
      router.push("/sell");
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Sign in to edit products</h2>
        <Link href="/auth" className="text-primary hover:underline mt-4 inline-block">
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted-foreground animate-pulse">
        Fetching product...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-destructive">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-primary hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/sell"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-foreground">Edit Product</h1>
        <button
          onClick={handleDelete}
          className="inline-flex items-center gap-2 px-4 py-2 border border-destructive text-destructive rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors text-sm font-medium"
        >
          <Trash2 className="w-4 h-4" /> Delete Product
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info + Stock */}
        <section className="p-6 border border-border rounded-lg bg-card space-y-4">
          <h2 className="text-xl font-semibold">Basic Information</h2>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background"
            required
          />
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background resize-y"
          />
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background"
            required
          />

          {/* Stock info and add field */}
          <div className="bg-muted/50 p-4 rounded-md space-y-2">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">
                Current stock: {currentStock !== null ? currentStock : "N/A"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">Add stock:</label>
              <input
                type="number"
                step="1"
                min="0"
                value={addStock}
                onChange={(e) => setAddStock(e.target.value)}
                placeholder="e.g., 10"
                className="w-32 px-3 py-2 border rounded-md bg-background"
              />
            </div>
          </div>
        </section>

        {/* Images – independent upload per slot */}
        <section className="p-6 border border-border rounded-lg bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Images</h2>
            {images.length < 5 && (
              <button type="button" onClick={addImageSlot} className="text-sm text-primary hover:underline">
                + Add another
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {images.map((slot, idx) => (
              <div key={idx} className="relative border rounded-lg p-2">
                {slot.url ? (
                  <div className="relative group">
                    <img src={slot.url} alt="Preview" className="w-full h-40 object-cover rounded" />
                    <button
                      type="button"
                      onClick={() => removeImageSlot(idx)}
                      className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                    <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileChange(idx, e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Category & Tags */}
        <section className="p-6 border border-border rounded-lg bg-card space-y-4">
          <h2 className="text-xl font-semibold">Categories & Tags</h2>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Stationery, Handmade"
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="leather, journal, handmade"
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
        </section>

        {/* Save */}
        <div className="flex gap-4 justify-end">
          <Link href="/sell" className="px-6 py-3 border rounded-md font-medium hover:bg-muted">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}