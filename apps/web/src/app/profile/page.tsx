"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  LogOut,
  Mail,
  User,
  Phone,
  MapPin,
} from "lucide-react";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState((user as any)?.phone || "");
  const [address, setAddress] = useState((user as any)?.address || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [coverUrl, setCoverUrl] = useState((user as any)?.cover_url || "");
  const [loading, setLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: "", new: "" });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone((user as any).phone || "");
      setAddress((user as any).address || "");
      setAvatarUrl(user.avatar_url || "");
      setCoverUrl((user as any).cover_url || "");
    }
  }, [user]);

  // Upload a file and return its public URL
  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiClient.post<{ url: string }>("/upload", formData);
    return res.url;
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      setAvatarUrl(url);
      toast.success("Avatar uploaded");
    } catch (err: any) {
      toast.error("Avatar upload failed");
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      setCoverUrl(url);
      toast.success("Cover uploaded");
    } catch (err: any) {
      toast.error("Cover upload failed");
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      await apiClient.put("/profile", {
        name,
        phone: phone || null,
        address: address || null,
        avatar_url: avatarUrl || null,
        cover_url: coverUrl || null,
      });
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.current || !passwordData.new) {
      toast.error("Fill in both password fields");
      return;
    }
    setLoading(true);
    try {
      await apiClient.put("/profile/password", {
        current_password: passwordData.current,
        new_password: passwordData.new,
      });
      toast.success("Password changed");
      setPasswordData({ current: "", new: "" });
    } catch (err: any) {
      toast.error(err.message || "Password change failed");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Not signed in</h2>
        <Link href="/auth" className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="w-4 h-4" /> Back to store
      </Link>

      {/* Cover Photo */}
      <div
        className="relative w-full h-48 sm:h-64 rounded-lg bg-muted mb-6 overflow-hidden group cursor-pointer"
        onClick={() => coverInputRef.current?.click()}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-r from-primary/10 to-primary/5">
            <Camera className="w-8 h-8 opacity-50" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="w-6 h-6 text-white" />
        </div>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleCoverChange}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="p-5 border border-border rounded-lg bg-card text-center">
            <div
              className="relative inline-block cursor-pointer group"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user.name}
                  className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-background"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary/20 mx-auto flex items-center justify-center text-3xl font-bold text-primary">
                  {user.name.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <h2 className="text-xl font-bold text-foreground mt-4">{user.name}</h2>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <Mail className="w-3 h-3" /> {user.email}
            </p>
            <button
              onClick={logout}
              className="mt-4 w-full px-4 py-2 border border-border rounded-md text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-2 space-y-8">
          <section className="p-6 border border-border rounded-lg bg-card">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-muted-foreground" /> Account Info
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  <Phone className="w-4 h-4 inline mr-1" /> Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-ring"
                  placeholder="+1234567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" /> Address
                </label>
                <textarea
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-ring resize-y"
                  placeholder="Your full address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Avatar URL (or click avatar to upload)</label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cover URL (or click cover to upload)</label>
                <input
                  type="text"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                onClick={handleUpdateProfile}
                disabled={loading}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </section>

          <section className="p-6 border border-border rounded-lg bg-card">
            <h2 className="text-xl font-semibold mb-4">Change Password</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwordData.current}
                  onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordData.new}
                  onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                onClick={handleChangePassword}
                disabled={loading}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
              >
                Update Password
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}