/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export',
  reactStrictMode: false, // disables double-invoke of effects in dev; no effect in production
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  transpilePackages: ['@radix-ui/react-progress'],
};

module.exports = nextConfig;
