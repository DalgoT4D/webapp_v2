/**
 * Comment States Array Lookup Tests
 *
 * Verifies that the array-based CommentStates format works correctly
 * with the .find() lookups used in page.tsx and chart-element-view.tsx.
 */

import type { CommentStates, CommentIconState } from '@/types/comments';

/** Mirrors the lookup in app/reports/[snapshotId]/page.tsx */
function lookupSummaryState(states: CommentStates | undefined): CommentIconState {
  return states?.find((s) => s.target_type === 'summary')?.state ?? 'none';
}

/** Mirrors the lookup in components/dashboard/chart-element-view.tsx */
function lookupChartState(states: CommentStates | undefined, chartId: number): CommentIconState {
  return (states?.find((s) => s.chart_id === chartId)?.state as CommentIconState) ?? 'none';
}

describe('Comment states array lookups', () => {
  const sampleStates: CommentStates = [
    { target_type: 'summary', chart_id: null, state: 'unread', count: 3, unread_count: 1 },
    { target_type: 'chart', chart_id: 19, state: 'read', count: 2, unread_count: 0 },
    { target_type: 'chart', chart_id: 34, state: 'mentioned', count: 1, unread_count: 1 },
  ];

  describe('lookupSummaryState', () => {
    it('finds summary state from array', () => {
      expect(lookupSummaryState(sampleStates)).toBe('unread');
    });

    it('returns "none" when states is undefined', () => {
      expect(lookupSummaryState(undefined)).toBe('none');
    });

    it('returns "none" when array is empty', () => {
      expect(lookupSummaryState([])).toBe('none');
    });

    it('returns "none" when no summary entry exists', () => {
      const chartsOnly: CommentStates = [
        { target_type: 'chart', chart_id: 10, state: 'read', count: 1, unread_count: 0 },
      ];
      expect(lookupSummaryState(chartsOnly)).toBe('none');
    });
  });

  describe('lookupChartState', () => {
    it('finds chart state by chart_id', () => {
      expect(lookupChartState(sampleStates, 19)).toBe('read');
      expect(lookupChartState(sampleStates, 34)).toBe('mentioned');
    });

    it('returns "none" for unknown chart_id', () => {
      expect(lookupChartState(sampleStates, 999)).toBe('none');
    });

    it('returns "none" when states is undefined', () => {
      expect(lookupChartState(undefined, 19)).toBe('none');
    });

    it('returns "none" when array is empty', () => {
      expect(lookupChartState([], 19)).toBe('none');
    });

    it('does not confuse chart entries across different chart_ids', () => {
      // chart_id 19 should not return chart_id 34's state
      expect(lookupChartState(sampleStates, 19)).not.toBe(lookupChartState(sampleStates, 34));
    });
  });

  describe('type structure', () => {
    it('each entry has required fields', () => {
      for (const entry of sampleStates) {
        expect(entry).toHaveProperty('target_type');
        expect(entry).toHaveProperty('chart_id');
        expect(entry).toHaveProperty('state');
        expect(entry).toHaveProperty('count');
        expect(entry).toHaveProperty('unread_count');
        expect(['summary', 'chart']).toContain(entry.target_type);
      }
    });

    it('chart entries have numeric chart_id', () => {
      const chartEntries = sampleStates.filter((s) => s.target_type === 'chart');
      for (const entry of chartEntries) {
        expect(typeof entry.chart_id).toBe('number');
      }
    });

    it('summary entries have null chart_id', () => {
      const summaryEntries = sampleStates.filter((s) => s.target_type === 'summary');
      for (const entry of summaryEntries) {
        expect(entry.chart_id).toBeNull();
      }
    });
  });
});
