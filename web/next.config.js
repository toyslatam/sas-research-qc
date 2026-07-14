const path = require('path');

// Cargar .env de la raíz del monorepo (Whispper_App/.env)
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Alinear nombres públicos ANTES de que Next compile middleware/edge
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
process.env.NEXT_PUBLIC_API_URL = backendUrl;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Use a dedicated output folder to avoid stale `.next` cache collisions.
  distDir: '.next-web',
  env: {
    NEXT_PUBLIC_API_URL: backendUrl,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
