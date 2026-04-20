import nextPwa from 'next-pwa';

const withPWA = nextPwa({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const baseConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@printstudio/shared', '@printstudio/db', '@printstudio/bambu-protocol'],
  experimental: {
    typedRoutes: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

const withWebpack = (cfg) => ({
  ...cfg,
  webpack: (config, context) => {
    // Workspace packages re-export with `.js` extensions (Node ESM convention),
    // but the actual files are `.ts`. Teach webpack to try `.ts`/`.tsx` when `.js` is requested.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.js', '.ts', '.tsx'],
    };
    if (typeof cfg.webpack === 'function') {
      return cfg.webpack(config, context);
    }
    return config;
  },
});

export default withWebpack(withPWA(baseConfig));
