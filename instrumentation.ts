// Next.js instrumentation hook — the entry point for server-side Sentry setup.
// Next.js calls register() once when the server starts; it dynamically imports
// the correct Sentry config based on the runtime (nodejs vs edge).
// onRequestError is a Next.js v15 hook that fires on unhandled server request errors,
// wired to Sentry.captureRequestError so SSR failures and API errors are automatically reported.
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
