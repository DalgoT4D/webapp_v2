/**
 * The unified onboarding-path events. Every walkthrough (product tour, both insight forks,
 * automate-pipeline) reports through these five events with a `path` property, so
 * "which walkthrough did this user run, how far, how long, where did they quit" is one
 * PostHog query per question instead of one per flow.
 */
const mockCapture = jest.fn();

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    capture: (...args: unknown[]) => mockCapture(...args),
    register: jest.fn(),
    identify: jest.fn(),
    group: jest.fn(),
    reset: jest.fn(),
    setPersonProperties: jest.fn(),
    get_distinct_id: jest.fn(),
  },
}));

import { ONBOARDING_PATHS } from '@/constants/analytics';
import {
  startOnboardingPath,
  resumeOnboardingPath,
  trackOnboardingPathStage,
  completeOnboardingPath,
  exitOnboardingPath,
} from '@/lib/onboarding-analytics';
import {
  setWalkthroughScope,
  clearWalkthroughScope,
  USER_A,
  USER_B,
  ORG_A,
  ORG_B,
} from '@/components/onboarding/__tests__/walkthrough-scope-utils';

/** Epoch ms the fake clock starts at — any fixed value works, the deltas are what matter. */
const T0 = 1_700_000_000_000;

function atTime(ms: number, fn: () => void): void {
  const spy = jest.spyOn(Date, 'now').mockReturnValue(ms);
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  setWalkthroughScope(USER_A, ORG_A);
});

describe('startOnboardingPath', () => {
  it('captures path_started with the path', () => {
    startOnboardingPath(ONBOARDING_PATHS.WALKTHROUGH);
    expect(mockCapture).toHaveBeenCalledWith('onboarding:path_started', {
      path: 'walkthrough',
    });
  });

  it('includes the entry point when one is given', () => {
    startOnboardingPath(ONBOARDING_PATHS.INSIGHT_OWN_DATA, { entry: 'chart' });
    expect(mockCapture).toHaveBeenCalledWith('onboarding:path_started', {
      path: 'insight_own_data',
      entry: 'chart',
    });
  });
});

describe('trackOnboardingPathStage', () => {
  it('captures path_stage_viewed with path and stage', () => {
    trackOnboardingPathStage(ONBOARDING_PATHS.INSIGHT_SAMPLE, 'kpi_target');
    expect(mockCapture).toHaveBeenCalledWith('onboarding:path_stage_viewed', {
      path: 'insight_sample',
      stage: 'kpi_target',
    });
  });

  it('includes stage_index when the caller knows the position in the flow', () => {
    trackOnboardingPathStage(ONBOARDING_PATHS.WALKTHROUGH, 'sidebar_ingest', { stageIndex: 3 });
    expect(mockCapture).toHaveBeenCalledWith('onboarding:path_stage_viewed', {
      path: 'walkthrough',
      stage: 'sidebar_ingest',
      stage_index: 3,
    });
  });
});

describe('resumeOnboardingPath', () => {
  it('captures path_resumed with the stage the user came back to', () => {
    resumeOnboardingPath(ONBOARDING_PATHS.PIPELINE, 'pipeline_ingest');
    expect(mockCapture).toHaveBeenCalledWith('onboarding:path_resumed', {
      path: 'pipeline',
      stage: 'pipeline_ingest',
    });
  });
});

describe('completeOnboardingPath', () => {
  it('captures path_completed with the seconds elapsed since the path started', () => {
    atTime(T0, () => startOnboardingPath(ONBOARDING_PATHS.PIPELINE));
    atTime(T0 + 90_000, () => completeOnboardingPath(ONBOARDING_PATHS.PIPELINE));
    expect(mockCapture).toHaveBeenLastCalledWith('onboarding:path_completed', {
      path: 'pipeline',
      duration_seconds: 90,
    });
  });

  it('measures across a reload — the start time is persisted, not held in memory', () => {
    atTime(T0, () => startOnboardingPath(ONBOARDING_PATHS.INSIGHT_SAMPLE));
    jest.resetModules();
    atTime(T0 + 3_600_000, () => completeOnboardingPath(ONBOARDING_PATHS.INSIGHT_SAMPLE));
    expect(mockCapture).toHaveBeenLastCalledWith('onboarding:path_completed', {
      path: 'insight_sample',
      duration_seconds: 3600,
    });
  });

  it('omits duration_seconds when no start was recorded, rather than reporting zero', () => {
    // Storage cleared mid-flow (private mode, another device). A 0 here would silently
    // drag every duration average down.
    completeOnboardingPath(ONBOARDING_PATHS.WALKTHROUGH);
    expect(mockCapture).toHaveBeenCalledWith('onboarding:path_completed', {
      path: 'walkthrough',
    });
  });

  it('clears the recorded start so a second run measures itself, not the first', () => {
    atTime(T0, () => startOnboardingPath(ONBOARDING_PATHS.PIPELINE));
    atTime(T0 + 10_000, () => completeOnboardingPath(ONBOARDING_PATHS.PIPELINE));
    atTime(T0 + 20_000, () => completeOnboardingPath(ONBOARDING_PATHS.PIPELINE));
    expect(mockCapture).toHaveBeenLastCalledWith('onboarding:path_completed', {
      path: 'pipeline',
    });
  });
});

describe('exitOnboardingPath', () => {
  it('captures path_exited with the stage quit on and the elapsed seconds', () => {
    atTime(T0, () => startOnboardingPath(ONBOARDING_PATHS.INSIGHT_OWN_DATA));
    atTime(T0 + 45_000, () =>
      exitOnboardingPath(ONBOARDING_PATHS.INSIGHT_OWN_DATA, 'own_data_ingest')
    );
    expect(mockCapture).toHaveBeenLastCalledWith('onboarding:path_exited', {
      path: 'insight_own_data',
      stage: 'own_data_ingest',
      duration_seconds: 45,
    });
  });

  it('sends a null stage through as null rather than dropping the property', () => {
    exitOnboardingPath(ONBOARDING_PATHS.WALKTHROUGH, null);
    expect(mockCapture).toHaveBeenCalledWith('onboarding:path_exited', {
      path: 'walkthrough',
      stage: null,
    });
  });
});

describe('start-time isolation', () => {
  it('keeps each path on its own clock', () => {
    atTime(T0, () => startOnboardingPath(ONBOARDING_PATHS.WALKTHROUGH));
    atTime(T0 + 60_000, () => startOnboardingPath(ONBOARDING_PATHS.PIPELINE));
    atTime(T0 + 90_000, () => completeOnboardingPath(ONBOARDING_PATHS.PIPELINE));
    expect(mockCapture).toHaveBeenLastCalledWith('onboarding:path_completed', {
      path: 'pipeline',
      duration_seconds: 30,
    });
  });

  it('does not leak a start time across users or orgs', () => {
    atTime(T0, () => startOnboardingPath(ONBOARDING_PATHS.PIPELINE));
    setWalkthroughScope(USER_B, ORG_A);
    atTime(T0 + 30_000, () => completeOnboardingPath(ONBOARDING_PATHS.PIPELINE));
    expect(mockCapture).toHaveBeenLastCalledWith('onboarding:path_completed', {
      path: 'pipeline',
    });

    setWalkthroughScope(USER_A, ORG_B);
    atTime(T0 + 40_000, () => completeOnboardingPath(ONBOARDING_PATHS.PIPELINE));
    expect(mockCapture).toHaveBeenLastCalledWith('onboarding:path_completed', {
      path: 'pipeline',
    });
  });

  it('still emits the event when there is no scope yet, without throwing', () => {
    clearWalkthroughScope();
    expect(() => startOnboardingPath(ONBOARDING_PATHS.WALKTHROUGH)).not.toThrow();
    expect(mockCapture).toHaveBeenCalledWith('onboarding:path_started', { path: 'walkthrough' });
  });
});
