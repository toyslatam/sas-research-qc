const path = require('path');

// Cargar .env de la raíz del monorepo (local). En Vercel vienen del dashboard.
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const backendUrl = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  'http://localhost:4001'
).replace(/\/$/, '');

process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
process.env.NEXT_PUBLIC_API_URL = backendUrl;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // En Vercel debe ser `.next` (default). Localmente evitamos choques de caché.
  distDir: process.env.VERCEL ? '.next' : '.next-web',
  env: {
    NEXT_PUBLIC_API_URL: backendUrl,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  async rewrites() {
    if (!backendUrl) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
