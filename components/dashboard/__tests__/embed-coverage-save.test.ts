/**
 * The dashboard editor's autosave half of the embed-warning contract:
 * picker decisions ride on the PUT payload, and a rejected 409 save is
 * parsed back out for the recovery dialog instead of being swallowed.
 */
import {
  EMPTY_PENDING_COVERAGE,
  coverage409Message,
  coverageDismissKey,
  coveragePayloadFields,
  mergeCoverageDecision,
  parseEmbedCoverage409,
} from '@/components/dashboard/embed-coverage-save';
import type { ChartCoverageVerdict } from '@/hooks/api/useResourceAccess';

function verdict(overrides: Partial<ChartCoverageVerdict>): ChartCoverageVerdict {
  return {
    chart_id: 1,
    title: 'Salary Breakdown',
    covered: false,
    role_gaps: [],
    principal_gaps: [],
    public_exposure: false,
    extendable: false,
    viewer_can_edit: false,
    ...overrides,
  };
}

describe('coveragePayloadFields', () => {
  it('adds nothing when there is no pending confirmation (payload shape stays stable)', () => {
    expect(coveragePayloadFields(EMPTY_PENDING_COVERAGE)).toEqual({});
  });

  it('carries extend_chart_ids and proceed only when set', () => {
    expect(coveragePayloadFields({ extendChartIds: [7, 9], proceed: false })).toEqual({
      extend_chart_ids: [7, 9],
    });
    expect(coveragePayloadFields({ extendChartIds: [], proceed: true })).toEqual({
      proceed: true,
    });
    expect(coveragePayloadFields({ extendChartIds: [7], proceed: true })).toEqual({
      extend_chart_ids: [7],
      proceed: true,
    });
  });
});

describe('mergeCoverageDecision', () => {
  it('accumulates decisions across several picks, deduplicated', () => {
    const first = mergeCoverageDecision(EMPTY_PENDING_COVERAGE, {
      extendChartIds: [7],
      proceed: false,
    });
    const second = mergeCoverageDecision(first, { extendChartIds: [7, 9], proceed: true });
    expect(second).toEqual({ extendChartIds: [7, 9], proceed: true });
    // proceed never un-sets
    expect(mergeCoverageDecision(second, { extendChartIds: [], proceed: false }).proceed).toBe(
      true
    );
  });
});

describe('parseEmbedCoverage409', () => {
  it('extracts the verdicts from a 409 EmbedCoverageConfirmation error', () => {
    const error = Object.assign(new Error('Confirmation required'), {
      status: 409,
      body: {
        requires_confirmation: true,
        under_covering_charts: [verdict({ chart_id: 7 })],
        detail: 'Confirmation required: newly added charts under-cover this dashboard',
      },
    });
    expect(parseEmbedCoverage409(error)).toEqual([verdict({ chart_id: 7 })]);
  });

  it('returns null for non-409 errors and 409s without verdicts', () => {
    expect(parseEmbedCoverage409(Object.assign(new Error('locked'), { status: 423 }))).toBeNull();
    expect(
      parseEmbedCoverage409(
        Object.assign(new Error('conflict'), { status: 409, body: { detail: 'other' } })
      )
    ).toBeNull();
    expect(parseEmbedCoverage409(new Error('network'))).toBeNull();
  });
});

describe('coverage409Message', () => {
  it('names the rejected charts', () => {
    expect(coverage409Message([verdict({ title: 'Salary Breakdown' })])).toBe(
      'Not saved yet — "Salary Breakdown" isn\'t shared with everyone who can see this dashboard.'
    );
    expect(
      coverage409Message([verdict({ title: 'A' }), verdict({ chart_id: 2, title: 'B' })])
    ).toContain('"A", "B" aren\'t shared');
  });
});

describe('coverageDismissKey', () => {
  it('is stable across verdict order (so a cancelled prompt stays dismissed)', () => {
    const a = verdict({ chart_id: 1 });
    const b = verdict({ chart_id: 2 });
    expect(coverageDismissKey([a, b])).toBe(coverageDismissKey([b, a]));
    expect(coverageDismissKey([a])).not.toBe(coverageDismissKey([a, b]));
  });
});
