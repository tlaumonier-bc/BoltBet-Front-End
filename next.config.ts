import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  async redirects() {
    return [
      {
        source: "/dk/lyn-radar",
        destination: "/dk/tordenvejr-kort",
        permanent: true,
      },
      {
        source: "/ee/lightning-map",
        destination: "/ee/aike-kaart",
        permanent: true,
      },
      {
        source: "/lv/lightning-map",
        destination: "/lv/zibens-karte",
        permanent: true,
      },
      {
        source: "/pl/gdzie-jest-burza",
        destination: "/pl/radar-burz",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.lightningmapgame.com" }],
        destination: "https://lightningmapgame.com/:path*",
        permanent: true, // 301
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },

  skipTrailingSlashRedirect: true,
};

export default nextConfig;