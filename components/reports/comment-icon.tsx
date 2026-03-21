'use client';

import { memo } from 'react';
import { MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CommentIconState } from '@/types/comments';

interface CommentIconProps {
  state: CommentIconState;
  className?: string;
}

function CommentIconInner({ state, className }: CommentIconProps) {
  // Small red filled dot for unread/mentioned states
  const redDot = (
    <span
      data-testid="comment-dot-unread"
      className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-500"
    />
  );

  return (
    <span className="relative inline-flex items-center justify-center">
      <MessageSquareText className={cn('h-4 w-4', className)} />
      {/* Mentioned: small @ badge at bottom-right of icon */}
      {state === 'mentioned' && (
        <>
          <span
            data-testid="comment-mention-badge"
            className="absolute -bottom-1 -right-1.5 h-3 w-3 rounded-full bg-rose-500 text-white flex items-center justify-center text-[7px] font-bold leading-none"
          >
            @
          </span>
          {redDot}
        </>
      )}
      {state === 'unread' && redDot}
      {state === 'read' && (
        <span
          data-testid="comment-dot-outline"
          className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-muted-foreground"
        />
      )}
    </span>
  );
}

export const CommentIcon = memo(CommentIconInner);
