/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents duplicate WebRTC media stream initialization in dev
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'microphone=(self), camera=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
