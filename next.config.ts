import type { NextConfig } from 'next';
import path from 'path';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    };
    return config;
  },
};

// withSentryConfig wraps the build to upload source maps to Sentry (so stack traces
// show original source, not minified bundles) and strips them from production bundles
// so they're not publicly accessible.
export default withSentryConfig(nextConfig, {
  org: 'dalgo',
  project: 'webapp_v2',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Delete source maps from client bundles after upload to Sentry so they're not publicly accessible
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // Increases server load slightly; remove if that becomes an issue.
  tunnelRoute: '/monitoring',
});
