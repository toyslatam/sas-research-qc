const path = require('path');

// Cargar .env de la raíz del monorepo (local). En Vercel vienen del dashboard.
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch {
  // dotenv es opcional en Vercel (vars vienen del dashboard)
}

function normalizeBackendUrl(raw) {
  const trimmed = String(raw || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/$/, '');
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  // Si pegaron el host sin protocolo (ej. powerbiresearch.online)
  return `https://${trimmed}`;
}

const backendUrl = normalizeBackendUrl(
  process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    'http://localhost:4001',
);

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
  transpilePackages: ['@whispper/shared'],
  env: {
    NEXT_PUBLIC_API_URL: backendUrl,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  async rewrites() {
    if (!backendUrl || (!backendUrl.startsWith('http://') && !backendUrl.startsWith('https://'))) {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
