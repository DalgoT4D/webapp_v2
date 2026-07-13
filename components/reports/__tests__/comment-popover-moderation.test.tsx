/**
 * CommentPopover — moderation affordances by the `canModerate` capability
 * prop (Task 16 carry-over of Task 14's backend re-gate). Author self-rights
 * are unchanged (an author always sees Edit/Delete on their own comment);
 * `canModerate` additionally grants those same affordances on OTHER
 * people's comments, mirroring the backend's resolver-edit gate.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentPopover } from '../comment-popover';
import * as useCommentsHook from '@/hooks/api/useComments';
import { TestWrapper } from '@/test-utils/render';
import type { Comment } from '@/types/comments';

jest.mock('@/hooks/api/useComments');
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ getCurrentOrgUser: () => ({ email: 'viewer@test.com' }) }),
}));
jest.mock('@/lib/toast', () => ({
  toastError: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/hooks/useMentionInput', () => ({
  useMentionInput: (): object => ({
    text: '',
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

const othersComment: Comment = {
  id: 1,
  content: 'A comment from someone else',
  author_email: 'someone.else@test.com',
  created_at: '2026-07-01T09:00:00Z',
  updated_at: '2026-07-01T09:00:00Z',
  is_new: false,
  is_deleted: false,
} as Comment;

function setupMocks(comments: Comment[] = [othersComment]) {
  (useCommentsHook.useComments as jest.Mock).mockReturnValue({
    comments,
    isLoading: false,
    isError: null,
    mutate: jest.fn(),
  });
  (useCommentsHook.useMentionableUsers as jest.Mock).mockReturnValue({ users: [] });
  (useCommentsHook.markAsRead as jest.Mock) = jest.fn().mockResolvedValue(undefined);
}

const renderPopover = (canModerate?: boolean) =>
  render(
    <TestWrapper>
      <CommentPopover
        snapshotId={1}
        targetType="summary"
        state="unread"
        onStateChange={jest.fn()}
        canModerate={canModerate}
      />
    </TestWrapper>
  );

describe('CommentPopover — moderation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it("hides the edit/delete menu on another author's comment when canModerate is not passed (default false)", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole('button'));

    expect(await screen.findByTestId('comment-1')).toBeInTheDocument();
    expect(screen.queryByTestId('comment-menu-1')).not.toBeInTheDocument();
  });

  it("hides the edit/delete menu on another author's comment when canModerate is explicitly false", async () => {
    const user = userEvent.setup();
    renderPopover(false);

    await user.click(screen.getByRole('button'));

    expect(await screen.findByTestId('comment-1')).toBeInTheDocument();
    expect(screen.queryByTestId('comment-menu-1')).not.toBeInTheDocument();
  });

  it("shows the edit/delete menu on another author's comment when canModerate is true", async () => {
    const user = userEvent.setup();
    renderPopover(true);

    await user.click(screen.getByRole('button'));

    const menuTrigger = await screen.findByTestId('comment-menu-1');
    expect(menuTrigger).toBeInTheDocument();
    await user.click(menuTrigger);

    expect(await screen.findByTestId('edit-btn-1')).toBeInTheDocument();
    expect(screen.getByTestId('delete-btn-1')).toBeInTheDocument();
  });

  it("always shows the menu on the viewer's own comment, canModerate or not", async () => {
    setupMocks([{ ...othersComment, id: 2, author_email: 'viewer@test.com' }]);
    const user = userEvent.setup();
    renderPopover(false);

    await user.click(screen.getByRole('button'));

    expect(await screen.findByTestId('comment-menu-2')).toBeInTheDocument();
  });
});
