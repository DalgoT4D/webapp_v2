'use client';

import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { ArrowUp, Clock, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CommentIcon } from './comment-icon';
import {
  formatCommentTime,
  getAvatarColor,
  getInitials,
  parseCommentMentions,
  extractMentionedEmails,
} from './utils';
import { toastError } from '@/lib/toast';
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
import { useMentionInput } from '@/hooks/useMentionInput';

// Width of comment popover panel — matches Figma spec for comment thread panels
const COMMENT_POPOVER_WIDTH = 'w-[383px]';

// Max users shown in the mention dropdown before scrolling
const MENTION_DROPDOWN_LIMIT = 5;

// Delay (ms) before scrolling to latest comment — allows DOM to settle after render
const SCROLL_DELAY_MS = 100;

// Threshold (ms) between created_at and updated_at to consider a comment "edited"
// Small buffer accounts for backend processing time on initial create
const EDITED_THRESHOLD_MS = 1000;

interface CommentPopoverProps {
  snapshotId: number;
  targetType: 'summary' | 'chart';
  chartId?: number;
  state: CommentIconState;
  triggerClassName?: string;
  onStateChange?: () => void;
  autoOpen?: boolean;
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
    if (!filter) return users.slice(0, MENTION_DROPDOWN_LIMIT);
    const lowerFilter = filter.toLowerCase();
    return users
      .filter((u) => u.email.toLowerCase().includes(lowerFilter))
      .slice(0, MENTION_DROPDOWN_LIMIT);
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
              {getInitials(user.email)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{user.email}</span>
        </button>
      ))}
    </div>
  );
});

// ---- Comment Content with @mentions as blue links ----

const CommentContent = memo(function CommentContent({ content }: { content: string }) {
  const parts = useMemo(() => parseCommentMentions(content), [content]);

  return (
    <p className="text-sm mt-0.5 whitespace-pre-wrap break-all">
      {parts.map((part) =>
        part.type === 'mention' ? (
          <span key={`mention-${part.value}`} className="text-primary font-medium">
            {part.value}
          </span>
        ) : (
          <span key={`text-${part.value}`}>{part.value}</span>
        )
      )}
    </p>
  );
});

// ---- Single Comment ----

interface CommentItemProps {
  comment: Comment;
  onDelete: (commentId: number) => void;
  onSaveEdit: (commentId: number, content: string) => Promise<void>;
  currentUserEmail: string;
  isFirstNew: boolean;
  firstNewRef: React.RefObject<HTMLDivElement | null>;
  isDeleted: boolean;
  mentionableUsers: MentionableUser[];
}

const CommentItem = memo(function CommentItem({
  comment,
  onDelete,
  onSaveEdit,
  currentUserEmail,
  isFirstNew,
  firstNewRef,
  isDeleted,
  mentionableUsers,
}: CommentItemProps) {
  const isAuthor = comment.author_email === currentUserEmail;
  const avatarColor = useMemo(() => getAvatarColor(comment.author_email), [comment.author_email]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const editMention = useMentionInput();

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    editMention.setText(comment.content);
    requestAnimationFrame(() => editMention.inputRef.current?.focus());
  }, [comment.content, editMention]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    editMention.setText('');
    editMention.closeMentions();
  }, [editMention]);

  const handleSave = useCallback(async () => {
    const content = editMention.text.trim();
    if (!content || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveEdit(comment.id, content);
      setIsEditing(false);
      editMention.setText('');
    } finally {
      setIsSaving(false);
    }
  }, [editMention.text, isSaving, comment.id, onSaveEdit, editMention]);

  // Show "This message was deleted" placeholder
  if (isDeleted) {
    return (
      <div data-testid={`comment-${comment.id}-deleted`} className="group px-3 py-2 rounded-md">
        <div className="flex items-start gap-2">
          <Avatar className="h-7 w-7 text-xs flex-shrink-0 mt-0.5">
            <AvatarFallback
              style={{ backgroundColor: avatarColor }}
              className="text-white font-medium"
            >
              {getInitials(comment.author_email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{comment.author_email}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatCommentTime(comment.created_at)}
              </span>
            </div>
            <p className="text-sm mt-0.5 text-muted-foreground italic flex items-center gap-1">
              <Clock className="h-3 w-3" />
              This message was deleted
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={isFirstNew ? firstNewRef : undefined}
      data-testid={`comment-${comment.id}`}
      className="group px-3 py-2 rounded-md"
    >
      <div className="flex items-start gap-2">
        <Avatar className="h-7 w-7 text-xs flex-shrink-0 mt-0.5">
          <AvatarFallback
            style={{ backgroundColor: avatarColor }}
            className="text-white font-medium"
          >
            {getInitials(comment.author_email)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          {!isEditing ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{comment.author_email}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatCommentTime(comment.created_at)}
                </span>
                {Math.abs(
                  new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime()
                ) > EDITED_THRESHOLD_MS && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    &middot; edited
                  </span>
                )}
                {comment.is_new && (
                  <span
                    data-testid={`comment-new-dot-${comment.id}`}
                    className="h-2 w-2 rounded-full flex-shrink-0 ml-auto"
                    style={{ backgroundColor: 'rgba(0, 137, 123, 0.4)' }}
                  />
                )}
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
                        onClick={handleStartEdit}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        data-testid={`delete-btn-${comment.id}`}
                        className="text-destructive focus:text-destructive"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <CommentContent content={comment.content} />
            </>
          ) : (
            <>
              <div className="relative">
                <MentionDropdown
                  users={mentionableUsers}
                  filter={editMention.mentionQuery}
                  onSelect={editMention.handleMentionSelect}
                  visible={editMention.showMentions}
                />
                <textarea
                  ref={editMention.inputRef as React.RefObject<HTMLTextAreaElement>}
                  data-testid={`comment-edit-textarea-${comment.id}`}
                  value={editMention.text}
                  onChange={editMention.handleChange}
                  className="w-full text-sm border rounded-md p-2 min-h-[60px] resize-none bg-background outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive hover:bg-destructive/10 uppercase text-xs font-semibold"
                  data-testid={`cancel-edit-btn-${comment.id}`}
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-primary text-white hover:opacity-90 uppercase text-xs font-semibold"
                  data-testid={`save-edit-btn-${comment.id}`}
                  onClick={handleSave}
                  disabled={!editMention.text.trim() || isSaving}
                >
                  Save
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This change cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="uppercase text-xs font-semibold"
              data-testid={`cancel-delete-btn-${comment.id}`}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90 uppercase text-xs font-semibold"
              data-testid={`confirm-delete-btn-${comment.id}`}
              onClick={() => onDelete(comment.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

// ---- Main Popover ----

function CommentPopoverInner({
  snapshotId,
  targetType,
  chartId,
  state,
  triggerClassName,
  onStateChange,
  autoOpen = false,
}: CommentPopoverProps) {
  const [open, setOpen] = useState(false);

  // Auto-open popover when linked from email notification
  useEffect(() => {
    if (autoOpen) {
      setOpen(true);
    }
  }, [autoOpen]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const draftMention = useMentionInput();
  const firstNewRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to latest comment when popover opens
  useEffect(() => {
    if (!open || !bottomRef.current) return undefined;

    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, SCROLL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open, comments.length]);

  // Mark as read on close
  const handleOpenChange = useCallback(
    async (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        // Reset state
        draftMention.setText('');
        draftMention.closeMentions();

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
    [snapshotId, targetType, chartId, onStateChange, draftMention]
  );

  // Submit new comment
  const handleSubmit = useCallback(async () => {
    const content = draftMention.text.trim();
    if (!content || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createComment({
        snapshot_id: snapshotId,
        target_type: targetType,
        chart_id: chartId,
        content,
        mentioned_emails: extractMentionedEmails(content),
      });
      draftMention.setText('');
      await mutateComments();
      onStateChange?.();
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, SCROLL_DELAY_MS);
    } catch (error) {
      toastError.create(error, 'comment');
    } finally {
      setIsSubmitting(false);
    }
  }, [draftMention, isSubmitting, snapshotId, targetType, chartId, mutateComments, onStateChange]);

  // Keyboard shortcut: Enter to submit, Shift+Enter ignored (single-line input)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        draftMention.closeMentions();
      }
    },
    [handleSubmit, draftMention]
  );

  const handleSaveEdit = useCallback(
    async (commentId: number, content: string) => {
      try {
        await updateComment(commentId, {
          content,
          mentioned_emails: extractMentionedEmails(content),
        });
        mutateComments();
        onStateChange?.();
      } catch (error) {
        toastError.update(error, 'comment');
        throw error;
      }
    },
    [mutateComments, onStateChange]
  );

  const handleDelete = useCallback(
    async (commentId: number) => {
      try {
        await deleteComment(commentId);
        mutateComments();
        onStateChange?.();
      } catch (error) {
        toastError.delete(error, 'comment');
      }
    },
    [mutateComments, onStateChange]
  );

  const hasDraft = draftMention.text.trim().length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={triggerClassName}
          data-testid={`comment-trigger-${targetType}${chartId ? `-${chartId}` : ''}`}
          aria-label={`${targetType === 'summary' ? 'Summary' : 'Chart'} comments`}
        >
          <CommentIcon state={state} className={open ? 'text-primary' : undefined} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={`${COMMENT_POPOVER_WIDTH} p-0 flex flex-col max-h-[min(450px,80vh)] rounded-lg border bg-popover shadow-none`}
        style={{
          borderColor: 'var(--primary)',
        }}
        onInteractOutside={(e) => {
          // Prevent close when clicking mention dropdown
          const target = e.target as HTMLElement;
          if (target.closest('[data-testid="mention-dropdown"]')) {
            e.preventDefault();
          }
        }}
      >
        {/* Comment list — only rendered when there are comments */}
        {comments.length > 0 && (
          <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
            <div className="py-2 space-y-0.5">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onSaveEdit={handleSaveEdit}
                  onDelete={handleDelete}
                  currentUserEmail={currentUserEmail}
                  isFirstNew={comment.id === firstNewCommentId}
                  firstNewRef={firstNewRef}
                  isDeleted={comment.is_deleted}
                  mentionableUsers={mentionableUsers}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        )}

        {/* Add comment input */}
        <div className={cn('p-3 flex-shrink-0', comments.length > 0 && 'border-t')}>
          <div className="relative">
            <MentionDropdown
              users={mentionableUsers}
              filter={draftMention.mentionQuery}
              onSelect={draftMention.handleMentionSelect}
              visible={draftMention.showMentions}
            />
            <div className="flex items-center gap-2">
              <input
                ref={draftMention.inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                data-testid="comment-input"
                value={draftMention.text}
                onChange={draftMention.handleChange}
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
                  'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
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
