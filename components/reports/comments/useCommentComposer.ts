import { useCallback, useMemo, useState, type KeyboardEvent, type RefObject } from 'react';
import { toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { createComment, markAsRead } from '@/hooks/api/useComments';
import { useMentionInput } from '@/hooks/useMentionInput';
import { extractMentionedEmails } from '@/components/reports/utils';
import {
  buildMarkReadAfterPostPayload,
  countLiveComments,
  filterMentionableUsers,
  type CommentTargetType,
} from '@/components/reports/logic/comments';
import { MENTION_DROPDOWN_LIMIT, SCROLL_DELAY_MS } from '@/components/reports/constants';
import { handleMentionListKey } from '@/components/reports/comments/mention-keyboard';
import type { Comment, MentionableUser } from '@/types/comments';

interface UseCommentComposerArgs {
  snapshotId: number;
  targetType: CommentTargetType;
  chartId?: number;
  comments: Comment[];
  mutateComments: () => Promise<unknown>;
  mentionableUsers: MentionableUser[];
  bottomRef: RefObject<HTMLDivElement | null>;
  onStateChange?: () => void;
}

/** The "Add a comment" input: draft with @mentions, Enter to post, post + mark-read + analytics. */
export function useCommentComposer({
  snapshotId,
  targetType,
  chartId,
  comments,
  mutateComments,
  mentionableUsers,
  bottomRef,
  onStateChange,
}: UseCommentComposerArgs) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    text: draft,
    setText: setDraft,
    showMentions,
    mentionQuery,
    highlightedIndex,
    setHighlightedIndex,
    handleChange,
    handleMentionSelect,
    closeMentions,
    inputRef,
  } = useMentionInput();

  // Compute filtered users for mention dropdown (lifted from MentionDropdown for keyboard nav access)
  const filteredMentionUsers = useMemo(
    () => filterMentionableUsers(mentionableUsers, mentionQuery, MENTION_DROPDOWN_LIMIT),
    [mentionableUsers, mentionQuery]
  );

  // Submit new comment
  const handleSubmit = useCallback(async () => {
    const content = draft.trim();
    if (!content || isSubmitting) return;

    // Read the thread size BEFORE posting: mutateComments below makes every comment look
    // like a reply. There is no parent_id in the comments API — a thread is flat per
    // target — so "reply" means this target already had a live comment on it.
    const mentionedEmails = extractMentionedEmails(content);
    const existingComments = countLiveComments(comments);

    setIsSubmitting(true);
    try {
      await createComment(snapshotId, {
        target_type: targetType,
        target_id: chartId,
        content,
        mentioned_emails: mentionedEmails,
      });
      // No author property: PostHog attaches the person who fired this. Mention COUNT
      // only — the mentioned addresses are PII and must never be sent.
      trackEvent(ANALYTICS_EVENTS.REPORT_COMMENT_CREATED, {
        report_id: snapshotId,
        target_type: targetType,
        is_reply: existingComments > 0,
        thread_size: existingComments + 1,
        mention_count: mentionedEmails.length,
      });
      setDraft('');
      await mutateComments();
      // New comment is created with is_new: true — mark as read immediately so
      // the icon shows outline dot (read) instead of filled red dot (unread)
      try {
        await markAsRead(snapshotId, buildMarkReadAfterPostPayload(targetType, chartId));
      } catch {
        // Silent fail
      }
      onStateChange?.();
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, SCROLL_DELAY_MS);
    } catch (error) {
      toastError.create(error, 'comment');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    draft,
    isSubmitting,
    snapshotId,
    targetType,
    chartId,
    comments,
    mutateComments,
    onStateChange,
    setDraft,
    bottomRef,
  ]);

  // Keyboard: Arrow keys for mention navigation, Enter to select/submit, Escape to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const handledByMentionList = handleMentionListKey(e, {
        isListOpen: showMentions,
        users: filteredMentionUsers,
        highlightedIndex,
        setHighlightedIndex,
        onSelect: handleMentionSelect,
        onClose: closeMentions,
      });
      if (handledByMentionList) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        closeMentions();
      }
    },
    [
      showMentions,
      filteredMentionUsers,
      highlightedIndex,
      handleMentionSelect,
      handleSubmit,
      closeMentions,
      setHighlightedIndex,
    ]
  );

  /** Popover closed: drop the draft and the mention list. */
  const resetDraft = useCallback(() => {
    setDraft('');
    closeMentions();
  }, [setDraft, closeMentions]);

  return {
    draft,
    hasDraft: draft.trim().length > 0,
    isSubmitting,
    showMentions,
    highlightedIndex,
    setHighlightedIndex,
    filteredMentionUsers,
    inputRef,
    handleChange,
    handleMentionSelect,
    handleKeyDown,
    handleSubmit,
    resetDraft,
  };
}

export type CommentComposerState = ReturnType<typeof useCommentComposer>;
