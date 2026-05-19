import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that require authentication
const protectedPaths = [
  "/checkout",
  "/orders",
  "/sell",
  "/profile",
  "/admin",
];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("marketplace_token")?.value;

  // If the request is for a protected path and no token exists, redirect to /auth
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !token) {
    const authUrl = new URL("/auth", request.url);
    // Optionally preserve the destination so we can redirect back after login
    authUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.next();
}

// Apply middleware only to these paths (faster performance)
export const config = {
  matcher: [
    "/checkout/:path*",
    "/orders/:path*",
    "/sell/:path*",
    "/profile/:path*",
    "/admin/:path*",
  ],
};