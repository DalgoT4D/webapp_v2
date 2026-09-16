/*
 * Covers:
 * 1. markAsRead fires on open (not close)
 * 2. markAsRead fires after posting a new comment
 * 3. comment analytics — thread start vs reply, and no PII in the payload
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentPopover } from '../comment-popover';
import * as useCommentsHook from '@/hooks/api/useComments';
import { TestWrapper } from '@/test-utils/render';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

// ============ Mocks ============

jest.mock('@/hooks/api/useComments');
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ getCurrentOrgUser: () => ({ email: 'user@test.com' }) }),
}));
jest.mock('@/lib/toast', () => ({
  toastError: { create: jest.fn() },
}));
const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));
jest.mock('@/hooks/useMentionInput', () => ({
  useMentionInput: (): object => ({
    text: 'Hello',
    setText: jest.fn(),
    showMentions: false,
    mentionQuery: '',
    highlightedIndex: -1,
    setHighlightedIndex: jest.fn(),
    handleChange: jest.fn(),
    handleMentionSelect: jest.fn(),
    closeMentions: jest.fn(),
    inputRef: { current: null },
  }),
}));

const mockMarkAsRead = jest.fn().mockResolvedValue(undefined);
const mockCreateComment = jest.fn().mockResolvedValue({ id: 1 });
const mockMutateComments = jest.fn().mockResolvedValue(undefined);

function setupMocks(comments: unknown[] = []) {
  (useCommentsHook.useComments as jest.Mock).mockReturnValue({
    comments,
    isLoading: false,
    isError: null,
    mutate: mockMutateComments,
  });
  (useCommentsHook.useMentionableUsers as jest.Mock).mockReturnValue({ users: [] });
  (useCommentsHook.markAsRead as jest.Mock) = mockMarkAsRead;
  (useCommentsHook.createComment as jest.Mock) = mockCreateComment;
}

const renderPopover = () =>
  render(
    <TestWrapper>
      <CommentPopover
        snapshotId={1}
        targetType="summary"
        state="unread"
        onStateChange={jest.fn()}
      />
    </TestWrapper>
  );

// ============ Tests ============

describe('CommentPopover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  describe('Mark as read on open', () => {
    it('calls markAsRead when popover is opened', async () => {
      const user = userEvent.setup();
      renderPopover();

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith(1, {
          target_type: 'summary',
          chart_id: undefined,
        });
      });
    });
  });

  describe('Mark as read after posting a comment', () => {
    it('calls markAsRead after submitting a comment', async () => {
      const user = userEvent.setup();
      renderPopover();

      await user.click(screen.getByRole('button')); // open
      mockMarkAsRead.mockClear(); // ignore open-time call

      const submitBtn = await screen.findByTestId('comment-submit-btn');
      await user.click(submitBtn);

      await waitFor(() => {
        expect(mockCreateComment).toHaveBeenCalled();
        expect(mockMarkAsRead).toHaveBeenCalled();
      });
    });
  });

  // There is no parent_id in the comments API — a thread is flat per target — so a reply
  // is a comment on a target that already has a live one. The thread size must be read
  // BEFORE posting, or the mutate() that follows makes every comment look like a reply.
  describe('Comment analytics', () => {
    // CommentItem renders a relative timestamp, so an existing comment needs real dates
    // or formatCommentTime throws on an invalid date.
    const existingComment = (id: number, overrides: Record<string, unknown> = {}) => ({
      id,
      content: 'Earlier note',
      author_email: 'someone@ngo.org',
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
      is_deleted: false,
      is_new: false,
      ...overrides,
    });

    async function submitComment() {
      const user = userEvent.setup();
      renderPopover();
      await user.click(screen.getByRole('button')); // open
      await user.click(await screen.findByTestId('comment-submit-btn'));
    }

    it('marks the first comment on a target as a thread start, not a reply', async () => {
      await submitComment();

      await waitFor(() =>
        expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.REPORT_COMMENT_CREATED, {
          report_id: 1,
          target_type: 'summary',
          is_reply: false,
          thread_size: 1,
          mention_count: 0,
        })
      );
    });

    it('marks a comment on an existing thread as a reply', async () => {
      setupMocks([existingComment(1), existingComment(2)]);

      await submitComment();

      await waitFor(() =>
        expect(mockTrackEvent).toHaveBeenCalledWith(
          ANALYTICS_EVENTS.REPORT_COMMENT_CREATED,
          expect.objectContaining({ is_reply: true, thread_size: 3 })
        )
      );
    });

    it('ignores deleted comments when deciding whether this is a reply', async () => {
      setupMocks([existingComment(1, { is_deleted: true })]);

      await submitComment();

      await waitFor(() =>
        expect(mockTrackEvent).toHaveBeenCalledWith(
          ANALYTICS_EVENTS.REPORT_COMMENT_CREATED,
          expect.objectContaining({ is_reply: false, thread_size: 1 })
        )
      );
    });

    it('never sends comment content or author emails', async () => {
      setupMocks([existingComment(1)]);

      await submitComment();

      await waitFor(() => expect(mockTrackEvent).toHaveBeenCalled());
      const payload = JSON.stringify(mockTrackEvent.mock.calls);
      expect(payload).not.toContain('@ngo.org');
      expect(payload).not.toContain('Hello');
    });
  });
});
