import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [];
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /require.extensions is not supported by webpack, Use a loader instead./,
    ];
    return config;
  },
};

export default nextConfig;
