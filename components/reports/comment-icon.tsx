'use client';

import { memo } from 'react';
import { MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CommentIconState } from '@/types/comments';

// Red indicator for unread/mention badges — matches notification badge color across the app
const INDICATOR_COLOR = 'var(--destructive)';

interface CommentIconProps {
  state: CommentIconState;
  className?: string;
}

function CommentIconInner({ state, className }: CommentIconProps) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <MessageSquareText className={cn('h-5 w-5', className)} />
      {state === 'mentioned' && (
        <span
          data-testid="comment-mention-badge"
          className="absolute -top-1 -right-1.5 h-3 w-3 rounded-full text-white flex items-center justify-center text-[8px] font-normal leading-none tracking-wide"
          style={{ backgroundColor: INDICATOR_COLOR }}
        >
          @
        </span>
      )}
      {state === 'unread' && (
        <span
          data-testid="comment-dot-unread"
          className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full"
          style={{ backgroundColor: INDICATOR_COLOR }}
        />
      )}
      {state === 'read' && (
        <span
          data-testid="comment-dot-outline"
          className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-white"
          style={{ border: `1.5px solid ${INDICATOR_COLOR}` }}
        />
      )}
    </span>
  );
}

export const CommentIcon = memo(CommentIconInner);
