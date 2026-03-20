'use client';

import { memo } from 'react';
import { MessageCircle, AtSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CommentIconState } from '@/types/comments';

interface CommentIconProps {
  state: CommentIconState;
  unreadCount?: number;
  className?: string;
}

function CommentIconInner({ state, unreadCount = 0, className }: CommentIconProps) {
  const badge =
    unreadCount > 0 ? (
      <span
        data-testid="comment-count-badge"
        className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[10px] font-medium text-white flex items-center justify-center leading-none"
      >
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    ) : null;

  if (state === 'mentioned') {
    return (
      <span className="relative inline-flex items-center justify-center">
        <AtSign className={cn('h-4 w-4', className)} />
        {badge}
      </span>
    );
  }

  return (
    <span className="relative inline-flex items-center justify-center">
      <MessageCircle className={cn('h-4 w-4', className)} />
      {badge}
      {!badge && state === 'read' && (
        <span
          data-testid="comment-dot-outline"
          className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-muted-foreground"
        />
      )}
    </span>
  );
}

export const CommentIcon = memo(CommentIconInner);
