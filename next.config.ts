import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  basePath: '',
  assetPrefix: '',
  async redirects() {
    return [];
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'neupgroup.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  turbopack: {},
  webpack: (config, { isServer }) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /require.extensions is not supported by webpack, Use a loader instead./,
    ];
    return config;
  },
};

export default nextConfig;
