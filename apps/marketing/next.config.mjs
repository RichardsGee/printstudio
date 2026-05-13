/** @type {import('next').NextConfig} */
const baseConfig = {
  // Static export — marketing é puramente static, deploy via nginx
  // (story 7.6 — Dockerfile multi-stage).
  output: 'export',
  reactStrictMode: true,
  transpilePackages: ['@printstudio/shared'],
  // Static export precisa images unoptimized
  images: {
    unoptimized: true,
  },
  experimental: {
    typedRoutes: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Workspace packages re-export com `.js` extensions (Node ESM),
  // mas arquivos reais são `.ts`. Mesmo padrão do apps/web.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.js', '.ts', '.tsx'],
    };
    return config;
  },
};

export default baseConfig;
