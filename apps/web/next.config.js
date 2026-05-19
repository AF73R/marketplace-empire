/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for development warnings
  reactStrictMode: true,

  // Rewrite API calls to the Go backend during development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/:path*`,
      },
    ];
  },

  // Allow external images from common CDNs and storage providers
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Enable instrumentation for monitoring
  experimental: {
    instrumentationHook: false,
    // ⬇︎ Moved from top‑level; required in Next.js 14
    serverComponentsExternalPackages: ['@marketplace/shared-types'],
  },
};

module.exports = nextConfig;