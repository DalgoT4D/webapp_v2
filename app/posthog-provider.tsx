'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    // No key in local/dev without analytics configured → skip init silently.
    if (!key || posthog.__loaded) return;

    // Ingestion host. We send events directly to PostHog rather than through the
    // '/relay' reverse proxy (next.config.ts rewrites): that proxy depends on a
    // Next rewrite that isn't reliable across our deployments and was returning
    // 404 in production, dropping all analytics. Direct ingestion has no infra
    // dependency. Trade-off: ad-blockers can block it (the only thing the proxy
    // bought us). Override per-region via NEXT_PUBLIC_POSTHOG_INGEST_HOST
    // (e.g. EU: https://eu.i.posthog.com). To switch back to the proxy, set this
    // to '/relay' once the rewrite is confirmed working.
    const ingestHost = process.env.NEXT_PUBLIC_POSTHOG_INGEST_HOST || 'https://us.i.posthog.com';

    posthog.init(key, {
      api_host: ingestHost,
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
