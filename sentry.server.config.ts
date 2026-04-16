// Server-side (Node.js) Sentry initialization.
// Captures errors during SSR, API route handlers, and server components.
// No Session Replay here — that's browser-only.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_WEBAPP_ENVIRONMENT || 'development',
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

  // 20% of transactions traced — sufficient for performance insights without burning quota
  tracesSampleRate: 0.2,

  debug: false,
});
