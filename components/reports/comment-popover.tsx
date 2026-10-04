'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CommentIcon } from './comment-icon';
import { markAsRead } from '@/hooks/api/useComments';
import type { CommentIconState } from '@/types/comments';
import { buildMarkReadOnOpenPayload } from '@/components/reports/logic/comments';
import { COMMENT_POPOVER_WIDTH } from '@/components/reports/constants';
import { CommentThread } from '@/components/reports/comments/CommentThread';
import { CommentComposer } from '@/components/reports/comments/CommentComposer';
import { useCommentThread } from '@/components/reports/comments/useCommentThread';
import { useCommentComposer } from '@/components/reports/comments/useCommentComposer';

interface CommentPopoverProps {
  snapshotId: number;
  targetType: 'summary' | 'chart' | 'kpi';
  chartId?: number;
  state: CommentIconState;
  triggerClassName?: string;
  onStateChange?: () => void;
  autoOpen?: boolean;
  /** True when the caller has Edit access on the parent report — enables the
   * moderator "Delete" action on other users' comments. Author-only Edit
   * remains gated separately. */
  canModerate?: boolean;
}

/** aria-label prefix of the trigger button. */
const TARGET_LABELS = { summary: 'Summary', kpi: 'KPI', chart: 'Chart' } as const;

function CommentPopoverInner({
  snapshotId,
  targetType,
  chartId,
  state,
  triggerClassName,
  onStateChange,
  autoOpen = false,
  canModerate = false,
}: CommentPopoverProps) {
  const [open, setOpen] = useState(false);

  // Auto-open popover when linked from email notification.
  // PINNED-BUGS: "Deep-link auto-open never marks the thread read" — this opens through setOpen,
  // not handleOpenChange, so no mark-read is sent.
  useEffect(() => {
    if (autoOpen) {
      setOpen(true);
    }
  }, [autoOpen]);

  const thread = useCommentThread({ open, snapshotId, targetType, chartId, onStateChange });
  const composer = useCommentComposer({
    snapshotId,
    targetType,
    chartId,
    comments: thread.comments,
    mutateComments: thread.mutateComments,
    mentionableUsers: thread.mentionableUsers,
    bottomRef: thread.bottomRef,
    onStateChange,
  });
  const { resetDraft } = composer;

  // Mark as read on open (like LinkedIn/Slack — notifications clear when you open the panel)
  const handleOpenChange = useCallback(
    async (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen) {
        // Mark as read immediately when popover opens so the dot clears while user is reading
        try {
          await markAsRead(snapshotId, buildMarkReadOnOpenPayload(targetType, chartId));
          onStateChange?.();
        } catch {
          // Silent fail for mark-as-read
        }
      } else {
        // Reset draft state on close
        resetDraft();
      }
    },
    [snapshotId, targetType, chartId, onStateChange, resetDraft]
  );

  const testIdSuffix = `${targetType}${chartId ? `-${chartId}` : ''}`;
  const hasVisibleComments = thread.visibleComments.length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={triggerClassName}
          data-testid={`comment-trigger-${testIdSuffix}`}
          aria-label={`${TARGET_LABELS[targetType]} comments`}
        >
          <CommentIcon state={state} className={open ? 'text-primary' : undefined} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        data-testid={`comment-popover-${testIdSuffix}`}
        className={`${COMMENT_POPOVER_WIDTH} p-0 flex flex-col max-h-[min(450px,80vh)] rounded-lg border bg-popover shadow-none`}
        onInteractOutside={(e) => {
          // Prevent close when clicking mention dropdown
          const target = e.target as HTMLElement;
          if (target.closest('[data-testid="mention-dropdown"]')) {
            e.preventDefault();
          }
        }}
      >
        {/* Comment list — only rendered when there are visible comments */}
        {hasVisibleComments && (
          <CommentThread
            comments={thread.visibleComments}
            firstNewCommentId={thread.firstNewCommentId}
            firstNewRef={thread.firstNewRef}
            bottomRef={thread.bottomRef}
            currentUserEmail={thread.currentUserEmail}
            mentionableUsers={thread.mentionableUsers}
            canModerate={canModerate}
            onSaveEdit={thread.handleSaveEdit}
            onDelete={thread.handleDelete}
          />
        )}

        {/* Add comment input */}
        <CommentComposer composer={composer} hasCommentsAbove={hasVisibleComments} />
      </PopoverContent>
    </Popover>
  );
}

export const CommentPopover = memo(CommentPopoverInner);
