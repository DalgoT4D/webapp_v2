/**
 * CommentPopover Tests
 *
 * Covers the two behavioral changes:
 * 1. markAsRead fires on open (not close)
 * 2. markAsRead fires after posting a new comment
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentPopover } from '../comment-popover';
import * as useCommentsHook from '@/hooks/api/useComments';
import { TestWrapper } from '@/test-utils/render';

// ============ Mocks ============

jest.mock('@/hooks/api/useComments');
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ getCurrentOrgUser: () => ({ email: 'user@test.com' }) }),
}));
jest.mock('@/lib/toast', () => ({
  toastError: { create: jest.fn() },
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

function setupMocks() {
  (useCommentsHook.useComments as jest.Mock).mockReturnValue({
    comments: [],
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
});
