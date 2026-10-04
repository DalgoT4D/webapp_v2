'use client';

import { memo, useMemo, useState, type RefObject } from 'react';
import { Clock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCommentTime, getAvatarColor, getInitials } from '@/components/reports/utils';
import { isCommentEdited } from '@/components/reports/logic/comments';
import { CommentContent } from '@/components/reports/comments/CommentContent';
import { CommentEditForm } from '@/components/reports/comments/CommentEditForm';
import { DeleteCommentDialog } from '@/components/reports/comments/DeleteCommentDialog';
import { useCommentEditor } from '@/components/reports/comments/useCommentEditor';
import type { Comment, MentionableUser } from '@/types/comments';

interface CommentItemProps {
  comment: Comment;
  onDelete: (commentId: number) => void;
  onSaveEdit: (commentId: number, content: string) => Promise<void>;
  currentUserEmail: string;
  isFirstNew: boolean;
  firstNewRef: RefObject<HTMLDivElement | null>;
  isDeleted: boolean;
  mentionableUsers: MentionableUser[];
  canModerate: boolean;
}

/** "This message was deleted" placeholder row. */
function DeletedComment({ comment, avatarColor }: { comment: Comment; avatarColor: string }) {
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
          <p
            className="text-sm mt-0.5 text-muted-foreground italic flex items-center gap-1"
            data-testid={`comment-${comment.id}-deleted-text`}
          >
            <Clock className="h-3 w-3" />
            This message was deleted
          </p>
        </div>
      </div>
    </div>
  );
}

/** One comment: author, time, "edited"/new markers, Edit (author) / Delete (author or moderator). */
export const CommentItem = memo(function CommentItem({
  comment,
  onDelete,
  onSaveEdit,
  currentUserEmail,
  isFirstNew,
  firstNewRef,
  isDeleted,
  mentionableUsers,
  canModerate,
}: CommentItemProps) {
  const isAuthor = comment.author_email === currentUserEmail;
  const canEditComment = isAuthor;
  const canDeleteComment = isAuthor || canModerate;
  const showMenu = canEditComment || canDeleteComment;
  const avatarColor = useMemo(() => getAvatarColor(comment.author_email), [comment.author_email]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const editor = useCommentEditor(comment, mentionableUsers, onSaveEdit);

  if (isDeleted) return <DeletedComment comment={comment} avatarColor={avatarColor} />;

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
          {!editor.isEditing ? (
            <>
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-medium truncate"
                  data-testid={`comment-author-${comment.id}`}
                >
                  {comment.author_email}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatCommentTime(comment.created_at)}
                </span>
                {isCommentEdited(comment) && (
                  <span
                    className="text-xs text-muted-foreground flex-shrink-0"
                    data-testid={`comment-edited-${comment.id}`}
                  >
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
                {showMenu && (
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
                      {canEditComment && (
                        <DropdownMenuItem
                          data-testid={`edit-btn-${comment.id}`}
                          onClick={editor.handleStartEdit}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {canDeleteComment && (
                        <DropdownMenuItem
                          data-testid={`delete-btn-${comment.id}`}
                          className="text-destructive focus:text-destructive"
                          onClick={() => setShowDeleteConfirm(true)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <CommentContent content={comment.content} />
            </>
          ) : (
            <CommentEditForm commentId={comment.id} editor={editor} />
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <DeleteCommentDialog
        commentId={comment.id}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={() => onDelete(comment.id)}
      />
    </div>
  );
});
