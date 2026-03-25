/**
 * useComments Hook Tests
 *
 * Tests for the comment API hooks and mutation functions:
 * - useComments: fetches comments for a target
 * - useCommentStates: fetches comment indicator states
 * - useMentionableUsers: fetches users available for @mentions
 * - createComment, updateComment, deleteComment, markAsRead: mutations
 */

import { renderHook, waitFor } from '@testing-library/react';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet, mockApiPost, mockApiPut, mockApiDelete } from '@/test-utils/api';
import {
  useComments,
  useCommentStates,
  useMentionableUsers,
  createComment,
  updateComment,
  deleteComment,
  markAsRead,
} from '@/hooks/api/useComments';

describe('useComments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty comments when snapshotId is null', () => {
    const { result } = renderHook(() => useComments(null, 'summary'), {
      wrapper: TestWrapper,
    });

    expect(result.current.comments).toEqual([]);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('fetches comments when snapshotId is provided', async () => {
    const mockComments = [
      { id: 1, content: 'First comment', target_type: 'summary' },
      { id: 2, content: 'Second comment', target_type: 'summary' },
    ];
    mockApiGet.mockResolvedValue({ success: true, data: mockComments });

    const { result } = renderHook(() => useComments(42, 'summary'), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.comments).toEqual(mockComments);
    });

    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/api/comments/?'));
  });

  it('includes chartId in query params when provided', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: [] });

    renderHook(() => useComments(42, 'chart', 5), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('chart_id=5'));
    });
  });
});

describe('useCommentStates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty states when snapshotId is null', () => {
    const { result } = renderHook(() => useCommentStates(null), {
      wrapper: TestWrapper,
    });

    expect(result.current.states).toEqual([]);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('fetches comment states when snapshotId is provided', async () => {
    const mockStates = [
      { target_type: 'summary', chart_id: null, state: 'unread', count: 3, unread_count: 1 },
      { target_type: 'chart', chart_id: 5, state: 'read', count: 2, unread_count: 0 },
    ];
    mockApiGet.mockResolvedValue({ success: true, data: { states: mockStates } });

    const { result } = renderHook(() => useCommentStates(42), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.states).toEqual(mockStates);
    });
  });
});

describe('useMentionableUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches mentionable users', async () => {
    const mockUsers = [
      { email: 'alice@test.com', name: 'Alice' },
      { email: 'bob@test.com', name: 'Bob' },
    ];
    mockApiGet.mockResolvedValue({ success: true, data: mockUsers });

    const { result } = renderHook(() => useMentionableUsers(), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.users).toEqual(mockUsers);
    });
  });
});

describe('Mutation functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createComment', () => {
    it('posts a new comment and returns data', async () => {
      const mockComment = { id: 1, content: 'Test comment' };
      mockApiPost.mockResolvedValue({ success: true, data: mockComment });

      const result = await createComment({
        snapshot_id: 42,
        target_type: 'summary',
        content: 'Test comment',
      });

      expect(result).toEqual(mockComment);
      expect(mockApiPost).toHaveBeenCalledWith('/api/comments/', {
        snapshot_id: 42,
        target_type: 'summary',
        content: 'Test comment',
      });
    });
  });

  describe('updateComment', () => {
    it('updates a comment and returns data', async () => {
      const mockComment = { id: 1, content: 'Updated' };
      mockApiPut.mockResolvedValue({ success: true, data: mockComment });

      const result = await updateComment(1, { content: 'Updated' });

      expect(result).toEqual(mockComment);
      expect(mockApiPut).toHaveBeenCalledWith('/api/comments/1/', { content: 'Updated' });
    });
  });

  describe('deleteComment', () => {
    it('deletes a comment', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      await deleteComment(1);

      expect(mockApiDelete).toHaveBeenCalledWith('/api/comments/1/');
    });
  });

  describe('markAsRead', () => {
    it('marks comments as read', async () => {
      mockApiPost.mockResolvedValue(undefined);

      await markAsRead({
        snapshot_id: 42,
        target_type: 'summary',
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/comments/mark-read/', {
        snapshot_id: 42,
        target_type: 'summary',
      });
    });

    it('includes chart_id when provided', async () => {
      mockApiPost.mockResolvedValue(undefined);

      await markAsRead({
        snapshot_id: 42,
        target_type: 'chart',
        chart_id: 5,
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/comments/mark-read/', {
        snapshot_id: 42,
        target_type: 'chart',
        chart_id: 5,
      });
    });
  });
});
