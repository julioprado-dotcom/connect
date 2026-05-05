import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // output: 'standalone', // Disabled: use next start directly

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    // Tree-shake lucide-react, @base-ui, framer-motion
    optimizePackageImports: [
      'lucide-react',
      '@base-ui/react',
      'framer-motion',
    ],
  },

  // Cache headers: stale-while-revalidate para APIs GET
  // NOTA Z.ai: No se incluyen X-Frame-Options, CSP ni HSTS
  // porque bloquean el funcionamiento en iframe cross-origin.
  async headers() {
    return [
      {
        source: '/api/stats',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=120' },
        ],
      },
      {
        source: '/api/medios',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' },
        ],
      },
      {
        source: '/api/ejes',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' },
        ],
      },
      {
        source: '/api/personas',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=120, stale-while-revalidate=240' },
        ],
      },
      {
        source: '/api/indicadores/historico',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' },
        ],
      },
      {
        source: '/api/reportes/stats',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=120' },
        ],
      },
    ];
  },
};

export default nextConfig;
