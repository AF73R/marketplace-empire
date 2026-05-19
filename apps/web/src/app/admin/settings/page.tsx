"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, ShieldAlert } from "lucide-react";

interface Settings {
  tax_default_rate: number;
  tax_country_rates: string;
  shipping_default_rate: number;
  shipping_per_kg_rate: number;
  shipping_free_threshold: number;
  additional_cost: number;
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>({
    tax_default_rate: 0.2,
    tax_country_rates: "DE:0.19,FR:0.20,UK:0.20",
    shipping_default_rate: 500,
    shipping_per_kg_rate: 200,
    shipping_free_threshold: 5000,
    additional_cost: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Settings>("/settings");
      setSettings(data);
    } catch (err: any) {
      setError(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchSettings();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.put("/settings", settings);
      toast.success("Settings saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Admin Panel
      </Link>

      <h1 className="text-3xl font-bold text-foreground mb-8">Site Settings</h1>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground mt-2">Loading settings...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchSettings} className="mt-2 text-primary hover:underline">
            Retry
          </button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          {/* Tax Settings */}
          <section className="p-6 border border-border rounded-lg bg-card">
            <h2 className="text-xl font-semibold mb-4">Tax Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Default Tax Rate (0.20 = 20%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.tax_default_rate}
                  onChange={(e) =>
                    setSettings({ ...settings, tax_default_rate: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Country‑Specific Rates (e.g., DE:0.19,FR:0.20)
                </label>
                <input
                  type="text"
                  value={settings.tax_country_rates}
                  onChange={(e) =>
                    setSettings({ ...settings, tax_country_rates: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
            </div>
          </section>

          {/* Shipping Settings */}
          <section className="p-6 border border-border rounded-lg bg-card">
            <h2 className="text-xl font-semibold mb-4">Shipping Configuration</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Default Base Cost (cents)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={settings.shipping_default_rate}
                  onChange={(e) =>
                    setSettings({ ...settings, shipping_default_rate: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Per‑Kg Rate (cents)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={settings.shipping_per_kg_rate}
                  onChange={(e) =>
                    setSettings({ ...settings, shipping_per_kg_rate: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Free Shipping Threshold (cents)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={settings.shipping_free_threshold}
                  onChange={(e) =>
                    setSettings({ ...settings, shipping_free_threshold: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Additional Cost (cents)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={settings.additional_cost}
                  onChange={(e) =>
                    setSettings({ ...settings, additional_cost: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      )}
    </div>
  );
}