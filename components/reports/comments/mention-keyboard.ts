import type { Dispatch, KeyboardEvent, SetStateAction } from 'react';
import type { MentionableUser } from '@/types/comments';

export interface MentionListKeyOptions {
  isListOpen: boolean;
  users: MentionableUser[];
  highlightedIndex: number;
  setHighlightedIndex: Dispatch<SetStateAction<number>>;
  onSelect: (user: MentionableUser) => void;
  onClose: () => void;
}

/**
 * Arrow keys (wrapping), Enter and Escape while the @mention list is open — shared by the
 * new-comment input and the edit box. Returns true when the key was handled; Enter with
 * nothing highlighted is not handled, so the caller can still submit.
 *
 * PINNED-BUGS: "Esc in @mention dropdown closes whole comment popover" — this only prevents the
 * input's default; the Radix Popover dismisses on Escape on its own.
 */
export function handleMentionListKey(
  e: KeyboardEvent<HTMLElement>,
  options: MentionListKeyOptions
): boolean {
  const { isListOpen, users, highlightedIndex, setHighlightedIndex, onSelect, onClose } = options;
  if (!isListOpen || users.length === 0) return false;
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setHighlightedIndex((prev) => (prev >= users.length - 1 ? 0 : prev + 1));
      return true;
    case 'ArrowUp':
      e.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? users.length - 1 : prev - 1));
      return true;
    case 'Enter':
      if (highlightedIndex >= 0 && users[highlightedIndex]) {
        e.preventDefault();
        onSelect(users[highlightedIndex]);
        return true;
      }
      return false;
    case 'Escape':
      e.preventDefault();
      onClose();
      return true;
    default:
      return false;
  }
}
