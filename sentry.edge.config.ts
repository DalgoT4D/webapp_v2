import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_WEBAPP_ENVIRONMENT || 'development',
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

  tracesSampleRate: 1,
  autoSessionTracking: true,

  debug: false,
});
