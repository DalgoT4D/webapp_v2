// Browser-side Sentry initialization.
// Configures error tracking, performance tracing, and Session Replay for the client.
// Session Replay records DOM changes so you can visually replay user sessions in Sentry.
// All text is masked and media is blocked for privacy.
// Network request/response bodies are captured only for same-origin (*.dalgo.in) API calls.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 20% of transactions traced — enough for performance insights without burning quota
  tracesSampleRate: 0.2,

  // 0% replay on normal sessions, 100% replay on error sessions.
  // Free tier gives 50 replays/month — recording every normal session would exhaust it in days.
  // Recording only error sessions keeps quota usage tied to actual incidents.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  // Off to avoid sending user IP/headers to Sentry by default
  sendDefaultPii: false,

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
      // Regex avoids SSR/build crashes where window.location.origin is undefined
      networkDetailAllowUrls: [/^https?:\/\/(.*\.)?dalgo\.in/],
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
