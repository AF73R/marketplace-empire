"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { apiClient } from "@/lib/api-client";
import type { User } from "@marketplace/shared-types";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// Helper to set a cookie (non‑HTTP‑only, so middleware can read it)
function setCookie(name: string, value: string, days = 3) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, restore token from localStorage (and cookie if present)
  useEffect(() => {
    const storedToken = localStorage.getItem("marketplace_token");
    if (storedToken) {
      setToken(storedToken);
      // Ensure cookie exists (in case it was cleared)
      setCookie("marketplace_token", storedToken);
      apiClient
        .get<User>("/profile")
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem("marketplace_token");
          deleteCookie("marketplace_token");
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<{ token: string }>("/auth/login", {
      email,
      password,
    });
    const newToken = res.token;
    localStorage.setItem("marketplace_token", newToken);
    setCookie("marketplace_token", newToken);
    setToken(newToken);
    const u = await apiClient.get<User>("/profile");
    setUser(u);
  }, []);

  const register = useCallback(
    async (email: string, name: string, password: string) => {
      const res = await apiClient.post<{ token: string }>("/auth/register", {
        email,
        name,
        password,
      });
      const newToken = res.token;
      localStorage.setItem("marketplace_token", newToken);
      setCookie("marketplace_token", newToken);
      setToken(newToken);
      const u = await apiClient.get<User>("/profile");
      setUser(u);
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("marketplace_token");
    deleteCookie("marketplace_token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}