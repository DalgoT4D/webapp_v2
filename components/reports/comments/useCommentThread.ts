import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { useAuthStore } from '@/stores/authStore';
import {
  deleteComment,
  updateComment,
  useComments,
  useMentionableUsers,
} from '@/hooks/api/useComments';
import { extractMentionedEmails } from '@/components/reports/utils';
import {
  findFirstNewCommentId,
  getVisibleComments,
  type CommentTargetType,
} from '@/components/reports/logic/comments';
import { SCROLL_DELAY_MS } from '@/components/reports/constants';

interface UseCommentThreadArgs {
  open: boolean;
  snapshotId: number;
  targetType: CommentTargetType;
  chartId?: number;
  onStateChange?: () => void;
}

/** A comment thread's data (fetched while open), scroll targets, and edit/delete actions. */
export function useCommentThread({
  open,
  snapshotId,
  targetType,
  chartId,
  onStateChange,
}: UseCommentThreadArgs) {
  const firstNewRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { comments, mutate: mutateComments } = useComments(
    open ? snapshotId : null,
    targetType,
    chartId
  );
  const { users: mentionableUsers } = useMentionableUsers(open);

  // Get current user email from auth store
  const currentUserEmail = useAuthStore((s) => s.getCurrentOrgUser()?.email ?? '');

  // Find the first new comment for scroll-to
  const firstNewCommentId = useMemo(() => findFirstNewCommentId(comments), [comments]);
  const visibleComments = useMemo(() => getVisibleComments(comments), [comments]);

  // Auto-scroll to latest comment when popover opens
  useEffect(() => {
    if (!open || !bottomRef.current) return undefined;

    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, SCROLL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open, comments.length]);

  const handleSaveEdit = useCallback(
    async (commentId: number, content: string) => {
      try {
        await updateComment(snapshotId, commentId, {
          content,
          mentioned_emails: extractMentionedEmails(content),
        });
        trackEvent(ANALYTICS_EVENTS.REPORT_COMMENT_UPDATED, {
          report_id: snapshotId,
          target_type: targetType,
        });
        mutateComments();
        onStateChange?.();
      } catch (error) {
        toastError.update(error, 'comment');
        throw error;
      }
    },
    [snapshotId, targetType, mutateComments, onStateChange]
  );

  const handleDelete = useCallback(
    async (commentId: number) => {
      try {
        await deleteComment(snapshotId, commentId);
        trackEvent(ANALYTICS_EVENTS.REPORT_COMMENT_DELETED, {
          report_id: snapshotId,
          target_type: targetType,
        });
        mutateComments();
        onStateChange?.();
      } catch (error) {
        toastError.delete(error, 'comment');
      }
    },
    [snapshotId, targetType, mutateComments, onStateChange]
  );

  return {
    comments,
    visibleComments,
    firstNewCommentId,
    mentionableUsers,
    currentUserEmail,
    mutateComments,
    firstNewRef,
    bottomRef,
    handleSaveEdit,
    handleDelete,
  };
}

export type CommentThreadState = ReturnType<typeof useCommentThread>;
