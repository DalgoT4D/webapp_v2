/**
 * Comment States Array Lookup Tests
 *
 * Runs the real lookups from components/reports/logic/comments.ts. Until R5a this file tested
 * local copies, and its "chart" copy matched by target_id — that is the KPI lookup
 * (findKpiCommentState). The real chart lookup reads chart_id and never finds a state
 * (PINNED-BUGS R-M2, pinned in components/reports/logic/__tests__/comments.test.ts).
 */

import type { CommentStates } from '@/types/comments';
import { findKpiCommentState, findSummaryCommentState } from '@/components/reports/logic/comments';

/** The viewer's summary lookup. */
const lookupSummaryState = findSummaryCommentState;

/** The target_id lookup KPI widgets use (ignores target_type). */
const lookupTargetIdState = findKpiCommentState;

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

  describe('lookupTargetIdState (findKpiCommentState)', () => {
    it('finds a chart-typed entry by target_id (the KPI lookup ignores target_type)', () => {
      expect(lookupTargetIdState(sampleStates, 19)).toBe('read');
      expect(lookupTargetIdState(sampleStates, 34)).toBe('mentioned');
    });

    it('finds kpi state by target_id', () => {
      expect(lookupTargetIdState(sampleStates, 42)).toBe('unread');
    });

    it('returns "none" for unknown target_id', () => {
      expect(lookupTargetIdState(sampleStates, 999)).toBe('none');
    });

    it('returns "none" when states is undefined', () => {
      expect(lookupTargetIdState(undefined, 19)).toBe('none');
    });

    it('returns "none" when array is empty', () => {
      expect(lookupTargetIdState([], 19)).toBe('none');
    });

    it('does not confuse entries across different target_ids', () => {
      expect(lookupTargetIdState(sampleStates, 19)).not.toBe(lookupTargetIdState(sampleStates, 34));
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
