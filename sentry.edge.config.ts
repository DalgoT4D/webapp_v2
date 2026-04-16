// Edge runtime Sentry initialization.
// Same config as server but for Next.js edge functions (middleware, edge API routes).
// Edge and Node.js are separate runtimes, so each needs its own Sentry init.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_WEBAPP_ENVIRONMENT || 'development',
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

  // 20% of transactions traced — sufficient for performance insights without burning quota
  tracesSampleRate: 0.2,

  debug: false,
});
