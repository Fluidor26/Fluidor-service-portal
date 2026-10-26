/** @type {import('next').NextConfig} */
const nextConfig = {
  // Zelfstandige build voor een container (Azure App Service / Container Apps).
  output: 'standalone',
  experimental: {
    // Documenten (handleidingen, tekeningen) worden via een server action geüpload.
    serverActions: { bodySizeLimit: '25mb' },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default nextConfig;
