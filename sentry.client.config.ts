// Browser-side Sentry initialization.
// Configures error tracking, performance tracing, and Session Replay for the client.
// Session Replay records DOM changes so you can visually replay user sessions in Sentry.
// - 10% of normal sessions are replayed; 100% of error sessions are replayed.
// - All text is masked and media is blocked for privacy.
// - Network request/response bodies are captured only for same-origin API calls.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_WEBAPP_ENVIRONMENT || 'development',
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

  // 20% of transactions traced — sufficient for performance insights without burning quota
  tracesSampleRate: 0.2,

  debug: false,

  replaysOnErrorSampleRate: 1.0,

  autoSessionTracking: true,

  // 10% of sessions get full replay; all error sessions get replay
  replaysSessionSampleRate: 0.1,

  // Filter out non-actionable browser noise so real bugs don't get buried
  ignoreErrors: [
    // Benign browser behavior — fires when a resize callback takes too long
    /ResizeObserver loop/,
    'ResizeObserver loop completed with undelivered notifications',

    // Third-party scripts rejecting promises with non-Error objects
    'Non-Error promise rejection captured',
    'Non-Error exception captured',

    // Transient network issues on user devices (flaky WiFi, going offline)
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    'Network request failed',
    /^TypeError: cancelled$/,

    // User navigated away before a fetch completed
    'AbortError',

    // Users on stale tabs after a deploy try to load chunks that no longer exist
    /Loading chunk [\d]+ failed/,
    'ChunkLoadError',
  ],

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
      // Use a regex pattern instead of window.location.origin to avoid SSR/build crashes
      // where window is undefined
      networkDetailAllowUrls: [/^https?:\/\/(.*\.)?dalgo\.in/],
    }),
  ],
});
