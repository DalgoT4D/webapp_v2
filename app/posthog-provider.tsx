'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    // No key in local/dev without analytics configured → skip init silently.
    if (!key || posthog.__loaded) return;

    posthog.init(key, {
      // Reverse proxy (next.config.ts rewrites) — resists ad/tracking blockers.
      // Path is '/relay' (not '/ingest') because the app already owns the
      // '/ingest' route for its data-ingestion feature.
      api_host: '/relay',
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      // Modern defaults: SPA pageview + pageleave autocapture, etc.
      defaults: '2026-01-30',
      // Page-load performance: capture Core Web Vitals (LCP/FCP/CLS/INP) per page.
      // network_timing is left off — it's heavier and can capture request URLs
      // (avoid with sensitive NGO data); opt in later if you need request timings.
      capture_performance: {
        web_vitals: true,
        network_timing: false,
      },
      // Only create person profiles for identified users (cost control).
      person_profiles: 'identified_only',
      // Sentry owns error tracking — do not double-capture exceptions here.
      capture_exceptions: false,
      // Privacy: NGO data — mask all input values in session replay.
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '[data-ph-mask]',
      },
      debug: process.env.NODE_ENV === 'development',
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
