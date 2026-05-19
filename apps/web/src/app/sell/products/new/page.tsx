"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, UploadCloud, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState<{ file: File | null; url: string }[]>([
    { file: null, url: "" },
  ]);
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [stock, setStock] = useState("");   // ★ Initial stock quantity

  // Upload a single image file and return its public URL
  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiClient.post<{ url: string }>("/upload", formData);
    return res.url;
  };

  // Handle file selection for a specific image slot
  const handleFileChange = async (idx: number, file: File | null) => {
    if (!file) return;
    try {
      toast.info("Uploading image...");
      const url = await uploadImage(file);
      const updated = [...images];
      updated[idx] = { file, url };
      setImages(updated);
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error("Image upload failed");
    }
  };

  const addImageSlot = () => {
    if (images.length < 5) setImages([...images, { file: null, url: "" }]);
  };

  const removeImageSlot = (idx: number) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !price) {
      toast.error("Title and price are required");
      return;
    }
    setLoading(true);
    try {
      const imageUrls = images.map((img) => img.url).filter((url) => url.trim() !== "");
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        price: Math.round(parseFloat(price) * 100),
        images: imageUrls,
        category: category.split(",").map((c) => c.trim()).filter(Boolean),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      // Include stock if a positive number was provided
      const stockNum = parseInt(stock, 10);
      if (!isNaN(stockNum) && stockNum > 0) {
        payload.stock = stockNum;
      }

      await apiClient.post("/products", payload);
      toast.success("Product listed successfully!");
      router.push("/sell");
    } catch (err: any) {
      toast.error(err.message || "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/sell"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <h1 className="text-3xl font-bold text-foreground mb-8">Create New Product</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <section className="p-6 border border-border rounded-lg bg-card space-y-4">
          <h2 className="text-xl font-semibold">Basic Information</h2>
          <input
            type="text"
            placeholder="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background"
            required
            maxLength={200}
          />
          <textarea
            rows={5}
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background resize-y"
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Price (USD) *"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              required
            />
            <input
              type="number"
              step="1"
              min="0"
              placeholder="Initial Stock (e.g., 10)"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>
        </section>

        {/* Images – file upload */}
        <section className="p-6 border border-border rounded-lg bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Images</h2>
            {images.length < 5 && (
              <button type="button" onClick={addImageSlot} className="text-sm text-primary hover:underline">
                + Add another
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Upload up to 5 images. First image is the thumbnail.</p>

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
            placeholder="Category (comma‑separated)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
          <input
            type="text"
            placeholder="Tags (comma‑separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
        </section>

        {/* Action */}
        <div className="flex gap-4 justify-end">
          <Link href="/sell" className="px-6 py-3 border rounded-md font-medium hover:bg-muted">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? "Creating..." : "List Product"}
          </button>
        </div>
      </form>
    </div>
  );
}