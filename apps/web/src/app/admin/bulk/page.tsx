"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  UploadCloud,
  ShieldAlert,
  Loader2,
} from "lucide-react";

export default function AdminBulkPage() {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      // Fetch CSV from backend
      const response = await fetch("/api/bulk/export", {
        headers: { Authorization: `Bearer ${localStorage.getItem("marketplace_token")}` },
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "products_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Please select a CSV file");
      return;
    }
    setImporting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post<{ created: number; errors: string[] }>(
        "/bulk/import",
        formData
      );
      setResult(res);
      toast.success(`Created ${res.created} product(s)`);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <ShieldAlert className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Admin Access Required</h2>
        <Link href="/auth" className="mt-4 inline-block text-primary hover:underline">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Admin Panel
      </Link>

      <h1 className="text-3xl font-bold text-foreground mb-8">Bulk Product Management</h1>

      {/* Export Section */}
      <section className="p-6 border border-border rounded-lg bg-card mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" /> Export Products
        </h2>
        <p className="text-muted-foreground mb-4">
          Download all active products as a CSV file.
        </p>
        <button
          onClick={handleExport}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
        >
          Download CSV
        </button>
      </section>

      {/* Import Section */}
      <section className="p-6 border border-border rounded-lg bg-card">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <UploadCloud className="w-5 h-5" /> Import Products
        </h2>
        <p className="text-muted-foreground mb-4">
          Upload a CSV file with columns: title, description, price, images (pipe‑separated), category, tags, stock (optional).
        </p>
        <form onSubmit={handleImport} className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            required
          />
          <button
            type="submit"
            disabled={importing}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {importing ? "Importing..." : "Upload & Import"}
          </button>
        </form>

        {result && (
          <div className="mt-6 p-4 bg-muted rounded-md">
            <p className="font-semibold text-green-600">
              Created {result.created} product(s)
            </p>
            {result.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-destructive">Errors:</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {result.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}