import {
  filterMentionableUsers,
  findChartCommentState,
  findKpiCommentState,
  findSummaryCommentState,
} from '@/components/reports/logic/comments';
import type { CommentStates } from '@/types/comments';

const states: CommentStates = [
  { target_type: 'summary', target_id: null, state: 'unread' },
  { target_type: 'chart', target_id: 19, state: 'read' },
  { target_type: 'kpi', target_id: 42, state: 'mentioned' },
];

describe('comment state lookups', () => {
  it('summary', () => {
    expect(findSummaryCommentState(states)).toBe('unread');
    expect(findSummaryCommentState(undefined)).toBe('none');
  });

  it('kpi matches target_id', () => {
    expect(findKpiCommentState(states, 42)).toBe('mentioned');
    expect(findKpiCommentState(states, 7)).toBe('none');
  });

  it('chart never finds its state (pinned: looks up chart_id, entries carry target_id)', () => {
    expect(findChartCommentState(states, 19)).toBe('none');
  });

  it('chart lookup matches an entry that does carry chart_id', () => {
    const legacy = [
      { target_type: 'chart', target_id: null, state: 'read', chart_id: 19 },
    ] as unknown as CommentStates;
    expect(findChartCommentState(legacy, 19)).toBe('read');
  });
});

describe('filterMentionableUsers', () => {
  const users = ['a@x.org', 'b@x.org', 'c@y.org', 'd@y.org', 'e@y.org', 'f@y.org'].map((email) => ({
    email,
  }));

  it('empty query returns the first N', () => {
    expect(filterMentionableUsers(users, '', 5).map((u) => u.email)).toEqual([
      'a@x.org',
      'b@x.org',
      'c@y.org',
      'd@y.org',
      'e@y.org',
    ]);
  });

  it('case-insensitive substring match, capped', () => {
    expect(filterMentionableUsers(users, 'X.ORG', 5).map((u) => u.email)).toEqual([
      'a@x.org',
      'b@x.org',
    ]);
    expect(filterMentionableUsers(users, 'y', 2).map((u) => u.email)).toEqual([
      'c@y.org',
      'd@y.org',
    ]);
  });
});
