'use client';

import type { RefObject } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CommentItem } from '@/components/reports/comments/CommentItem';
import type { Comment, MentionableUser } from '@/types/comments';

interface CommentThreadProps {
  comments: Comment[];
  firstNewCommentId: number | null;
  firstNewRef: RefObject<HTMLDivElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  currentUserEmail: string;
  mentionableUsers: MentionableUser[];
  canModerate: boolean;
  onSaveEdit: (commentId: number, content: string) => Promise<void>;
  onDelete: (commentId: number) => void;
}

/** The scrollable list of comments in a thread (rendered only when there is at least one). */
export function CommentThread({
  comments,
  firstNewCommentId,
  firstNewRef,
  bottomRef,
  currentUserEmail,
  mentionableUsers,
  canModerate,
  onSaveEdit,
  onDelete,
}: CommentThreadProps) {
  return (
    <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
      <div className="py-2 space-y-0.5">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onSaveEdit={onSaveEdit}
            onDelete={onDelete}
            currentUserEmail={currentUserEmail}
            isFirstNew={comment.id === firstNewCommentId}
            firstNewRef={firstNewRef}
            isDeleted={comment.is_deleted}
            mentionableUsers={mentionableUsers}
            canModerate={canModerate}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
