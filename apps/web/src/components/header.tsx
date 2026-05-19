"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { ShoppingCart, Store, User, LogOut, Package, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useCart } from "@/hooks/useCart";
import { SearchBar } from "@/components/search-bar";

export function Header() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY.current && currentY > 80) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border transition-all duration-300">
      {/* Top row: logo + search + nav icons */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-foreground font-bold text-xl">
          <span className="text-primary">🏛️</span> Empire
        </Link>

        {/* Desktop search (hidden on mobile) */}
        <div className="hidden sm:flex flex-1 max-w-md mx-4">
          <SearchBar />
        </div>

        {/* Navigation icons */}
        <nav className="flex items-center gap-4 sm:gap-4">
          <Link
            href="/products"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse
          </Link>

          {user && (
            <>
              <Link
                href="/orders"
                className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">Orders</span>
              </Link>
              <Link
                href="/sell"
                className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Store className="w-4 h-4" />
                <span className="hidden sm:inline">Sell</span>
              </Link>
            </>
          )}

          <Link
            href="/cart"
            className="relative inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="hidden sm:inline">Cart</span>
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <User className="w-5 h-5" />
                <span className="hidden sm:inline">{user.name}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-md shadow-lg z-50">
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <Link
                    href="/returns"
                    className="block px-4 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <RotateCcw className="w-4 h-4 inline mr-2" />
                    Returns
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-muted transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <User className="w-5 h-5" />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}
        </nav>
      </div>

      {/* Mobile search row – hides on scroll down */}
      <div
        className={`sm:hidden px-4 pb-3 transition-all duration-300 ${
          visible ? "opacity-100 max-h-20" : "opacity-0 max-h-0 overflow-hidden pb-0"
        }`}
      >
        <SearchBar />
      </div>
    </header>
  );
}