import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode for React 19
  reactStrictMode: true,

  // Image optimization
  images: {
    remotePatterns: [
      // Cloudflare R2
      {
        protocol: "https",
        hostname: "media.tablegh.com",
        pathname: "/**",
      },
      // R2 direct endpoint (dev)
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
        pathname: "/**",
      },
      // Placehold.co for seed data
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
    ],
    formats: ["image/webp", "image/avif"],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), payment=(self)",
          },
        ],
      },
    ];
  },

  // Redirect www to non-www
  async redirects() {
    return [
      {
        source: "/(.*)",
        has: [{ type: "host", value: "www.tablegh.com" }],
        destination: "https://tablegh.com/:path*",
        permanent: true,
      },
    ];
  },

  // Exclude webhook route from middleware (needs raw body)
  // See: middleware.ts
  experimental: {
    serverActions: {
      allowedOrigins: ["tablegh.com", "localhost:3000"],
    },
  },
};

export default nextConfig;
