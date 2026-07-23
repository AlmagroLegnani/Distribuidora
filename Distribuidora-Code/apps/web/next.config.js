// URL interna del backend (Express, packages/api). Nunca se expone al
// navegador: Next.js la usa solo del lado del servidor para reenviar
// /api/* y /health. El navegador siempre llama a rutas relativas del
// mismo origen (/api/..., /health).
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:3001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${INTERNAL_API_URL}/api/:path*` },
      { source: '/health', destination: `${INTERNAL_API_URL}/health` },
    ];
  },
};

module.exports = nextConfig;
