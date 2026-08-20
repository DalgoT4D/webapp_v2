/**
 * The one place the unified onboarding-path events are fired from.
 *
 * Every walkthrough — the guided product tour, both insight forks, automate-pipeline — reports
 * through these five calls with a `path` property, so a funnel or a drop-off question is one
 * PostHog query with a breakdown rather than one query per flow. Each flow ALSO keeps firing
 * its own legacy events; existing insights depend on those, and nothing here replaces them.
 *
 * Duration is measured here rather than left to PostHog because an onboarding path is not a
 * browser session: it survives reloads, and a user can start on Monday and finish on Thursday.
 * PostHog's $session_duration would only ever see one slice of that, so the start time is
 * persisted (localStorage, scoped per user+org exactly like the walkthrough's own state) and
 * the elapsed seconds ride the completion/exit event.
 */
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, type OnboardingPath } from '@/constants/analytics';
import { getWalkthroughScope, scopeSuffix } from '@/components/onboarding/walkthrough-scope';

const STARTED_AT_PREFIX = 'dalgo_onboarding_path_started_at_';

/** Per-path key: `<prefix><path>_<userId>_<orgSlug>` — one clock per walkthrough. */
function startedAtKey(path: OnboardingPath): string | null {
  const scope = getWalkthroughScope();
  if (!scope) return null;
  return `${STARTED_AT_PREFIX}${path}_${scopeSuffix(scope)}`;
}

function saveStartedAt(path: OnboardingPath): void {
  try {
    const key = startedAtKey(path);
    if (!key) return;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // Storage unavailable (private mode). The events still fire; only duration is lost.
  }
}

/**
 * Seconds since this path started, and forget the start time — a path ends exactly once, and
 * leaving the stamp behind would make a second run measure from the first run's start.
 *
 * Returns null when there is no usable stamp (storage cleared, private mode, flow begun on
 * another device). Callers then OMIT duration_seconds: a 0 would look like a real
 * instant-completion and drag every average down.
 */
function consumeDurationSeconds(path: OnboardingPath): number | null {
  try {
    const key = startedAtKey(path);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    localStorage.removeItem(key);
    if (!raw) return null;
    const startedAt = Number(raw);
    if (!Number.isFinite(startedAt)) return null;
    return Math.round((Date.now() - startedAt) / 1000);
  } catch {
    return null;
  }
}

export function startOnboardingPath(path: OnboardingPath, opts?: { entry?: string }): void {
  saveStartedAt(path);
  trackEvent(ANALYTICS_EVENTS.PATH_STARTED, {
    path,
    ...(opts?.entry ? { entry: opts.entry } : {}),
  });
}

/** A stored flow picked back up on a later page load — the same run continuing, not a new one. */
export function resumeOnboardingPath(path: OnboardingPath, stage: string | null): void {
  trackEvent(ANALYTICS_EVENTS.PATH_RESUMED, { path, stage });
}

export function trackOnboardingPathStage(
  path: OnboardingPath,
  stage: string,
  opts?: { stageIndex?: number }
): void {
  trackEvent(ANALYTICS_EVENTS.PATH_STAGE_VIEWED, {
    path,
    stage,
    ...(opts?.stageIndex === undefined ? {} : { stage_index: opts.stageIndex }),
  });
}

export function completeOnboardingPath(path: OnboardingPath): void {
  const durationSeconds = consumeDurationSeconds(path);
  trackEvent(ANALYTICS_EVENTS.PATH_COMPLETED, {
    path,
    ...(durationSeconds === null ? {} : { duration_seconds: durationSeconds }),
  });
}

/** Abandoned deliberately (Skip, close). `stage` is where they were when they quit. */
export function exitOnboardingPath(path: OnboardingPath, stage: string | null): void {
  const durationSeconds = consumeDurationSeconds(path);
  trackEvent(ANALYTICS_EVENTS.PATH_EXITED, {
    path,
    stage,
    ...(durationSeconds === null ? {} : { duration_seconds: durationSeconds }),
  });
}
