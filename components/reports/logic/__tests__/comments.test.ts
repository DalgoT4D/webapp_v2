import {
  buildMarkReadAfterPostPayload,
  buildMarkReadOnOpenPayload,
  countLiveComments,
  filterMentionableUsers,
  findChartCommentStateBuggyChartIdLookup,
  findFirstNewCommentId,
  findKpiCommentState,
  findSummaryCommentState,
  getVisibleComments,
  isCommentEdited,
} from '@/components/reports/logic/comments';
import type { Comment, CommentStates } from '@/types/comments';

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
    expect(findChartCommentStateBuggyChartIdLookup(states, 19)).toBe('none');
  });

  it('chart lookup matches an entry that does carry chart_id', () => {
    const legacy = [
      { target_type: 'chart', target_id: null, state: 'read', chart_id: 19 },
    ] as unknown as CommentStates;
    expect(findChartCommentStateBuggyChartIdLookup(legacy, 19)).toBe('read');
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

const makeComment = (overrides: Partial<Comment> = {}): Comment => ({
  id: 1,
  target_type: 'summary',
  snapshot_id: 1,
  content: 'Note',
  author_email: 'ana@ngo.org',
  is_new: false,
  is_deleted: false,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
  mentioned_emails: [],
  ...overrides,
});

describe('comment thread rules', () => {
  it('isCommentEdited: strictly more than 1000 ms between created_at and updated_at', () => {
    expect(isCommentEdited(makeComment())).toBe(false);
    expect(isCommentEdited(makeComment({ updated_at: '2026-08-01T00:00:01.000Z' }))).toBe(false);
    expect(isCommentEdited(makeComment({ updated_at: '2026-08-01T00:00:01.001Z' }))).toBe(true);
    // absolute difference: an updated_at before created_at also counts
    expect(isCommentEdited(makeComment({ created_at: '2026-08-01T00:00:05.000Z' }))).toBe(true);
  });

  it('getVisibleComments hides "deleted" placeholders only when every comment is deleted', () => {
    const live = makeComment({ id: 1 });
    const gone = makeComment({ id: 2, is_deleted: true });
    const both = [live, gone];
    expect(getVisibleComments(both)).toBe(both);
    expect(getVisibleComments([gone])).toEqual([]);
    expect(getVisibleComments([])).toEqual([]);
  });

  it('findFirstNewCommentId returns the first is_new comment, else null', () => {
    expect(
      findFirstNewCommentId([
        makeComment({ id: 1 }),
        makeComment({ id: 2, is_new: true }),
        makeComment({ id: 3, is_new: true }),
      ])
    ).toBe(2);
    expect(findFirstNewCommentId([makeComment()])).toBeNull();
  });

  it('countLiveComments ignores deleted comments', () => {
    expect(
      countLiveComments([makeComment({ id: 1 }), makeComment({ id: 2, is_deleted: true })])
    ).toBe(1);
  });

  it('mark-read payloads differ: opening sends target_id, posting sends chart_id (pinned)', () => {
    expect(JSON.stringify(buildMarkReadOnOpenPayload('kpi', 42))).toBe(
      '{"target_type":"kpi","target_id":42}'
    );
    expect(JSON.stringify(buildMarkReadAfterPostPayload('kpi', 42))).toBe(
      '{"target_type":"kpi","chart_id":42}'
    );
    expect(JSON.stringify(buildMarkReadOnOpenPayload('summary', undefined))).toBe(
      '{"target_type":"summary"}'
    );
    expect(JSON.stringify(buildMarkReadAfterPostPayload('summary', undefined))).toBe(
      '{"target_type":"summary"}'
    );
  });
});
