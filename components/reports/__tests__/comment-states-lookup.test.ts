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
function lookupChartState(states: CommentStates | undefined, targetId: number): CommentIconState {
  return (states?.find((s) => s.target_id === targetId)?.state as CommentIconState) ?? 'none';
}

describe('Comment states array lookups', () => {
  const sampleStates: CommentStates = [
    { target_type: 'summary', target_id: null, state: 'unread' },
    { target_type: 'chart', target_id: 19, state: 'read' },
    { target_type: 'chart', target_id: 34, state: 'mentioned' },
    { target_type: 'kpi', target_id: 42, state: 'unread' },
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
      const chartsOnly: CommentStates = [{ target_type: 'chart', target_id: 10, state: 'read' }];
      expect(lookupSummaryState(chartsOnly)).toBe('none');
    });
  });

  describe('lookupChartState', () => {
    it('finds chart state by target_id', () => {
      expect(lookupChartState(sampleStates, 19)).toBe('read');
      expect(lookupChartState(sampleStates, 34)).toBe('mentioned');
    });

    it('finds kpi state by target_id', () => {
      expect(lookupChartState(sampleStates, 42)).toBe('unread');
    });

    it('returns "none" for unknown target_id', () => {
      expect(lookupChartState(sampleStates, 999)).toBe('none');
    });

    it('returns "none" when states is undefined', () => {
      expect(lookupChartState(undefined, 19)).toBe('none');
    });

    it('returns "none" when array is empty', () => {
      expect(lookupChartState([], 19)).toBe('none');
    });

    it('does not confuse entries across different target_ids', () => {
      expect(lookupChartState(sampleStates, 19)).not.toBe(lookupChartState(sampleStates, 34));
    });
  });

  describe('type structure', () => {
    it('each entry has required fields', () => {
      for (const entry of sampleStates) {
        expect(entry).toHaveProperty('target_type');
        expect(entry).toHaveProperty('target_id');
        expect(entry).toHaveProperty('state');
        expect(['summary', 'chart', 'kpi']).toContain(entry.target_type);
      }
    });

    it('chart/kpi entries have numeric target_id', () => {
      const entityEntries = sampleStates.filter(
        (s) => s.target_type === 'chart' || s.target_type === 'kpi'
      );
      for (const entry of entityEntries) {
        expect(typeof entry.target_id).toBe('number');
      }
    });

    it('summary entries have null target_id', () => {
      const summaryEntries = sampleStates.filter((s) => s.target_type === 'summary');
      for (const entry of summaryEntries) {
        expect(entry.target_id).toBeNull();
      }
    });
  });
});
