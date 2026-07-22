import {
  summarizeCoverage,
  formatAudienceLabel,
} from '@/components/sharing/coverage-confirm-utils';
import type { ChartCoverageVerdict } from '@/hooks/api/useResourceAccess';

function verdict(overrides: Partial<ChartCoverageVerdict>): ChartCoverageVerdict {
  return {
    chart_id: 1,
    title: 'Chart',
    covered: false,
    role_gaps: [],
    principal_gaps: [],
    public_exposure: false,
    extendable: false,
    viewer_can_edit: false,
    ...overrides,
  };
}

describe('formatAudienceLabel', () => {
  it('names a group principal with the "group" suffix (design frame copy)', () => {
    expect(
      formatAudienceLabel([
        verdict({
          principal_gaps: [
            {
              principal_type: 'group',
              principal_id: 4,
              name: 'Funders',
              email: null,
              skipped_member: false,
            },
          ],
        }),
      ])
    ).toBe('Funders group');
  });

  it('names role gaps, user principals, invites, and public exposure, deduplicated', () => {
    const label = formatAudienceLabel([
      verdict({
        role_gaps: ['analyst', 'member'],
        principal_gaps: [
          {
            principal_type: 'user',
            principal_id: 9,
            name: 'Meera Das',
            email: 'meera@ngo.org',
            skipped_member: false,
          },
          {
            principal_type: 'invite',
            principal_id: null,
            name: null,
            email: null,
            skipped_member: false,
          },
        ],
        public_exposure: true,
      }),
      verdict({ role_gaps: ['analyst'] }),
    ]);
    expect(label).toBe('Analysts, Members, Meera Das, the invited user and anyone with the link');
  });

  it('falls back to a generic audience when there is no gap detail', () => {
    expect(formatAudienceLabel([verdict({})])).toBe('some viewers');
  });
});

describe('summarizeCoverage', () => {
  it('collects chart titles and counts', () => {
    const summary = summarizeCoverage([
      verdict({ chart_id: 1, title: 'A', role_gaps: ['analyst'], extendable: true }),
      verdict({ chart_id: 2, title: 'B', role_gaps: ['member'] }),
    ]);
    expect(summary.chartTitles).toEqual(['A', 'B']);
    expect(summary.chartCount).toBe(2);
  });

  it('extendChartIds only includes extendable charts the viewer can edit', () => {
    const summary = summarizeCoverage([
      verdict({ chart_id: 1, extendable: true, viewer_can_edit: true }),
      verdict({ chart_id: 2, extendable: true, viewer_can_edit: false }),
      verdict({ chart_id: 3, extendable: false, viewer_can_edit: true }),
    ]);
    expect(summary.extendChartIds).toEqual([1]);
    expect(summary.editBlockedTitles).toEqual(['Chart']);
  });

  it('flags residual exposure when extend cannot cover every gap (member/public classes)', () => {
    // fully extendable, viewer has edit, no informational classes → no residue
    expect(
      summarizeCoverage([
        verdict({
          chart_id: 1,
          role_gaps: ['analyst'],
          extendable: true,
          viewer_can_edit: true,
        }),
      ]).hasResidualExposure
    ).toBe(false);

    // public exposure is never extendable → residue
    expect(
      summarizeCoverage([verdict({ chart_id: 1, public_exposure: true })]).hasResidualExposure
    ).toBe(true);

    // member role gap is informational → residue
    expect(
      summarizeCoverage([
        verdict({
          chart_id: 1,
          role_gaps: ['analyst', 'member'],
          extendable: true,
          viewer_can_edit: true,
        }),
      ]).hasResidualExposure
    ).toBe(true);

    // a Member principal is skipped by extend → residue
    expect(
      summarizeCoverage([
        verdict({
          chart_id: 1,
          principal_gaps: [
            {
              principal_type: 'user',
              principal_id: 2,
              name: 'M',
              email: 'm@x.org',
              skipped_member: true,
            },
          ],
        }),
      ]).hasResidualExposure
    ).toBe(true);
  });
});
