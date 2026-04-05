import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // assetPrefix: '',
  basePath: '/account',
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
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