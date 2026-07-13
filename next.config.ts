import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const localDevBackend = process.env.LOCAL_DEV_BACKEND_URL?.replace(/\/$/, "");

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
        source: "/at/blitzortung",
        destination: "/at/gewitter",
        permanent: true,
      },
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
        source: "/gr/blitzortung",
        destination: "/gr/xartis-keravnon",
        permanent: true,
      },
      {
        source: "/hr/lighting-map",
        destination: "/hr/nevrijeme-munje",
        permanent: true,
      },
      {
        source: "/it/mappa-fulmini",
        destination: "/it/temporali-in-tempo-reale",
        permanent: true,
      },
      {
        source: "/lt/lighting-map",
        destination: "/lt/audra-zaibai",
        permanent: true,
      },
      {
        source: "/lv/lightning-map",
        destination: "/lv/zibens-karte",
        permanent: true,
      },
      {
        source: "/pl/blitzortung",
        destination: "/pl/mapa-wyladowan",
        permanent: true,
      },
      {
        source: "/pl/gdzie-jest-burza",
        destination: "/pl/radar-burz",
        permanent: true,
      },
      {
        source: "/ro/blitzortung",
        destination: "/ro/harta-fulgerelor",
        permanent: true,
      },
      {
        source: "/rs/lighting-map",
        destination: "/rs/nevreme-uzivo",
        permanent: true,
      },
      {
        source: "/sk/blesky",
        destination: "/sk/burka-nazivo",
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
      ...(localDevBackend
        ? [
            {
              source: "/api/:path*",
              destination: `${localDevBackend}/api/:path*`,
            },
          ]
        : []),
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