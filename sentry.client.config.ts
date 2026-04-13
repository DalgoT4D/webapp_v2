import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_WEBAPP_ENVIRONMENT || 'development',
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

  tracesSampleRate: 1,

  debug: false,

  replaysOnErrorSampleRate: 1.0,

  autoSessionTracking: true,

  // 10% of sessions get full replay; all error sessions get replay
  replaysSessionSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
      networkDetailAllowUrls: [window.location.origin],
    }),
  ],
});
