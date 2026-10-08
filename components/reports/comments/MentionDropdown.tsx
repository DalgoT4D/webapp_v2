'use client';

import { memo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarColor, getInitials } from '@/components/reports/utils';
import type { MentionableUser } from '@/types/comments';

interface MentionDropdownProps {
  filteredUsers: MentionableUser[];
  onSelect: (user: MentionableUser) => void;
  visible: boolean;
  highlightedIndex: number;
  onHighlightChange: (index: number) => void;
  listboxId: string;
}

/** The @mention list under a comment input (new comment or edit box). */
export const MentionDropdown = memo(function MentionDropdown({
  filteredUsers,
  onSelect,
  visible,
  highlightedIndex,
  onHighlightChange,
  listboxId,
}: MentionDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  if (!visible || filteredUsers.length === 0) return null;

  return (
    <div
      ref={listRef}
      id={listboxId}
      role="listbox"
      data-testid="mention-dropdown"
      className="absolute top-full left-0 right-0 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto mt-1 z-10"
    >
      {filteredUsers.map((user, idx) => (
        <button
          key={user.email}
          id={`${listboxId}-option-${user.email}`}
          role="option"
          aria-selected={idx === highlightedIndex}
          type="button"
          data-testid={`mention-user-${user.email}`}
          className={cn(
            'w-full text-left px-4 py-3 text-sm flex items-center gap-3',
            idx === highlightedIndex ? 'bg-accent' : 'hover:bg-accent'
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(user);
          }}
          onMouseEnter={() => onHighlightChange(idx)}
        >
          <Avatar className="h-7 w-7 text-xs flex-shrink-0">
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
