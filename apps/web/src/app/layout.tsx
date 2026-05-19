import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { CartProvider } from "@/hooks/useCart";
import { ChatBot } from "@/components/chat/chatbot";
import { Toaster } from "sonner";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Marketplace Empire — Buy & Sell Physical Goods",
    template: "%s — Marketplace Empire",
  },
  description:
    "A divine marketplace for physical goods. Buy from creators, sell your products, and get AI‑powered guidance every step of the way.",
  keywords: ["marketplace", "buy", "sell", "physical goods", "ecommerce"],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Marketplace Empire",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ea580c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider>
          <CartProvider>
            <div className="relative flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <ChatBot />
            <Toaster
              position="bottom-right"
              toastOptions={{
                classNames: {
                  toast: "bg-card text-foreground border border-border",
                  success: "text-green-600",
                  error: "text-red-600",
                },
              }}
              richColors
            />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}