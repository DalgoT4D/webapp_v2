'use client';

import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { ArrowUp, Pencil, Trash2, X, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CommentIcon } from './comment-icon';
import { formatCommentTime, getAvatarColor, getInitials, parseCommentMentions } from './utils';
import { toastSuccess, toastError } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import {
  useComments,
  useMentionableUsers,
  createComment,
  updateComment,
  deleteComment,
  markAsRead,
} from '@/hooks/api/useComments';
import type { Comment, CommentIconState, MentionableUser } from '@/types/comments';

interface CommentPopoverProps {
  snapshotId: number;
  targetType: 'report' | 'chart';
  chartId?: number;
  state: CommentIconState;
  count?: number;
  triggerClassName?: string;
  onStateChange?: () => void;
}

// ---- Mention Dropdown ----

interface MentionDropdownProps {
  users: MentionableUser[];
  filter: string;
  onSelect: (user: MentionableUser) => void;
  visible: boolean;
}

const MentionDropdown = memo(function MentionDropdown({
  users,
  filter,
  onSelect,
  visible,
}: MentionDropdownProps) {
  const filtered = useMemo(() => {
    if (!filter) return users.slice(0, 5);
    const lowerFilter = filter.toLowerCase();
    return users
      .filter(
        (u) =>
          u.email.toLowerCase().includes(lowerFilter) ||
          (u.name && u.name.toLowerCase().includes(lowerFilter))
      )
      .slice(0, 5);
  }, [users, filter]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      data-testid="mention-dropdown"
      className="absolute bottom-full left-0 right-0 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto mb-1 z-10"
    >
      {filtered.map((user) => (
        <button
          key={user.email}
          type="button"
          data-testid={`mention-user-${user.email}`}
          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(user);
          }}
        >
          <Avatar className="h-5 w-5 text-[10px] flex-shrink-0">
            <AvatarFallback
              style={{ backgroundColor: getAvatarColor(user.email) }}
              className="text-white"
            >
              {getInitials(user)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{user.name || user.email}</span>
          {user.name && (
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
          )}
        </button>
      ))}
    </div>
  );
});

// ---- Comment Content with @mentions as blue links ----

const CommentContent = memo(function CommentContent({ content }: { content: string }) {
  const parts = useMemo(() => parseCommentMentions(content), [content]);

  return (
    <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        part.type === 'mention' ? (
          <span key={i} className="text-primary font-medium">
            @{part.value}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </p>
  );
});

// ---- Single Comment ----

interface CommentItemProps {
  comment: Comment;
  onEdit: (comment: Comment) => void;
  onDelete: (commentId: number) => void;
  currentUserEmail: string;
  isFirstNew: boolean;
  firstNewRef: React.RefObject<HTMLDivElement | null>;
}

const CommentItem = memo(function CommentItem({
  comment,
  onEdit,
  onDelete,
  currentUserEmail,
  isFirstNew,
  firstNewRef,
}: CommentItemProps) {
  const isAuthor = comment.author.email === currentUserEmail;
  const avatarColor = useMemo(() => getAvatarColor(comment.author.email), [comment.author.email]);

  return (
    <div
      ref={isFirstNew ? firstNewRef : undefined}
      data-testid={`comment-${comment.id}`}
      className={cn(
        'group px-3 py-2 rounded-md',
        comment.is_new && 'bg-yellow-50 dark:bg-yellow-950/30'
      )}
    >
      <div className="flex items-start gap-2">
        <Avatar className="h-7 w-7 text-xs flex-shrink-0 mt-0.5">
          <AvatarFallback
            style={{ backgroundColor: avatarColor }}
            className="text-white font-medium"
          >
            {getInitials(comment.author)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{comment.author.email}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatCommentTime(comment.created_at)}
            </span>
            {/* Ellipsis menu — only visible on hover for author's own comments */}
            {isAuthor && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`comment-menu-${comment.id}`}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem
                    data-testid={`edit-btn-${comment.id}`}
                    onClick={() => onEdit(comment)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid={`delete-btn-${comment.id}`}
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(comment.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <CommentContent content={comment.content} />
        </div>
      </div>
    </div>
  );
});

// ---- Main Popover ----

function CommentPopoverInner({
  snapshotId,
  targetType,
  chartId,
  state,
  count,
  triggerClassName,
  onStateChange,
}: CommentPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const firstNewRef = useRef<HTMLDivElement>(null);

  const { comments, mutate: mutateComments } = useComments(
    open ? snapshotId : null,
    targetType,
    chartId
  );
  const { users: mentionableUsers } = useMentionableUsers();

  // Get current user email from auth store
  const currentUserEmail = useAuthStore((s) => s.getCurrentOrgUser()?.email ?? '');

  // Find the first new comment for scroll-to
  const firstNewCommentId = useMemo(() => {
    for (const c of comments) {
      if (c.is_new) return c.id;
    }
    return null;
  }, [comments]);

  // Auto-scroll to first new comment when popover opens
  useEffect(() => {
    if (!open || !firstNewCommentId || !firstNewRef.current) return undefined;

    const timer = setTimeout(() => {
      firstNewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => clearTimeout(timer);
  }, [open, firstNewCommentId]);

  // Mark as read on close
  const handleOpenChange = useCallback(
    async (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        // Reset state
        setDraft('');
        setEditingComment(null);
        setShowMentions(false);

        // Mark as read
        try {
          await markAsRead({
            snapshot_id: snapshotId,
            target_type: targetType,
            chart_id: chartId,
          });
          onStateChange?.();
        } catch {
          // Silent fail for mark-as-read
        }
      }
    },
    [snapshotId, targetType, chartId, onStateChange]
  );

  // Handle @ mention detection in input
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDraft(value);

    // Detect @ mention
    const cursorPos = e.target.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\S*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  }, []);

  // Insert selected mention into input
  const handleMentionSelect = useCallback(
    (user: MentionableUser) => {
      const cursorPos = inputRef.current?.selectionStart ?? draft.length;
      const textBeforeCursor = draft.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf('@');

      if (atIndex !== -1) {
        const before = draft.slice(0, atIndex);
        const after = draft.slice(cursorPos);
        const newDraft = `${before}@${user.email} ${after}`;
        setDraft(newDraft);
      }

      setShowMentions(false);

      // Re-focus input
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [draft]
  );

  // Submit new comment or edit
  const handleSubmit = useCallback(async () => {
    const content = draft.trim();
    if (!content || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (editingComment) {
        await updateComment(editingComment.id, content);
        toastSuccess.updated('Comment');
        setEditingComment(null);
      } else {
        await createComment({
          snapshot_id: snapshotId,
          target_type: targetType,
          chart_id: chartId,
          content,
        });
        toastSuccess.created('Comment');
      }
      setDraft('');
      mutateComments();
      onStateChange?.();
    } catch (error) {
      if (editingComment) {
        toastError.update(error, 'comment');
      } else {
        toastError.create(error, 'comment');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    draft,
    isSubmitting,
    editingComment,
    snapshotId,
    targetType,
    chartId,
    mutateComments,
    onStateChange,
  ]);

  // Keyboard shortcut: Enter to submit, Shift+Enter ignored (single-line input)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        setShowMentions(false);
      }
    },
    [handleSubmit]
  );

  const handleEdit = useCallback((comment: Comment) => {
    setEditingComment(comment);
    setDraft(comment.content);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleDelete = useCallback(
    async (commentId: number) => {
      try {
        await deleteComment(commentId);
        toastSuccess.deleted('Comment');
        mutateComments();
        onStateChange?.();
      } catch (error) {
        toastError.delete(error, 'comment');
      }
    },
    [mutateComments, onStateChange]
  );

  const hasDraft = draft.trim().length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={triggerClassName}
          data-testid={`comment-trigger-${targetType}${chartId ? `-${chartId}` : ''}`}
          aria-label={`${targetType === 'report' ? 'Report' : 'Chart'} comments`}
        >
          <CommentIcon state={state} count={count} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 flex flex-col max-h-[min(450px,80vh)]"
        onInteractOutside={(e) => {
          // Prevent close when clicking mention dropdown
          const target = e.target as HTMLElement;
          if (target.closest('[data-testid="mention-dropdown"]')) {
            e.preventDefault();
          }
        }}
      >
        {/* Comment list — no header, comments flow directly */}
        <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
          <div className="py-2 space-y-0.5">
            {comments.length === 0 ? (
              <p
                data-testid="no-comments-message"
                className="text-sm text-muted-foreground text-center py-8"
              >
                No comments yet. Start the conversation!
              </p>
            ) : (
              comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  currentUserEmail={currentUserEmail}
                  isFirstNew={comment.id === firstNewCommentId}
                  firstNewRef={firstNewRef}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t px-3 py-2.5 flex-shrink-0">
          {/* Edit indicator */}
          {editingComment && (
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              <Pencil className="h-3 w-3" />
              <span>Editing comment</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 ml-auto"
                data-testid="cancel-edit-btn"
                onClick={() => {
                  setEditingComment(null);
                  setDraft('');
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div className="relative">
            <MentionDropdown
              users={mentionableUsers}
              filter={mentionQuery}
              onSelect={handleMentionSelect}
              visible={showMentions}
            />
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                data-testid="comment-input"
                value={draft}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder="Add a comment"
                className="flex-1 h-8 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                data-testid="comment-submit-btn"
                onClick={handleSubmit}
                disabled={!hasDraft || isSubmitting}
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                  hasDraft
                    ? 'bg-primary text-white hover:opacity-90'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const CommentPopover = memo(CommentPopoverInner);
