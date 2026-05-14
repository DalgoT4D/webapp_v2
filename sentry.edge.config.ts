// Edge-runtime Sentry initialization.
// Used by Next.js middleware and edge route handlers (also active in local dev).
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 20% of transactions traced — enough for performance insights without burning quota
  tracesSampleRate: 0.2,

  enableLogs: true,

  // Off to avoid sending user IP/headers to Sentry by default
  sendDefaultPii: false,
});
