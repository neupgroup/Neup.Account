import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: '',
  assetPrefix: '',
  typescript: {
    // Run `npm run typecheck` separately to keep build fast.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'neupgroup.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'neupcdn.com',
        port: '',
        pathname: '/**',
      }
    ]
  },
  turbopack: {},
};

export default nextConfig;
