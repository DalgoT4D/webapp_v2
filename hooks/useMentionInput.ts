import { useState, useCallback, useRef, useEffect } from 'react';
import type { MentionableUser } from '@/types/comments';

// Regex to detect @mention-in-progress at the cursor position
const AT_MENTION_PATTERN = /@(\S*)$/;

interface UseMentionInputReturn {
  text: string;
  setText: (value: string) => void;
  showMentions: boolean;
  mentionQuery: string;
  /** Index of the currently highlighted item in the mention dropdown (-1 = none) */
  highlightedIndex: number;
  /** Update the highlighted index (e.g. on arrow keys or mouse hover) */
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
  /** Bind to onChange of an <input> or <textarea> */
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Call when a user is selected from the mention dropdown */
  handleMentionSelect: (user: MentionableUser) => void;
  /** Close the mention dropdown (e.g. on Escape) */
  closeMentions: () => void;
  /** Ref to attach to the input/textarea element for cursor position tracking */
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

/**
 * Shared hook for @mention detection and insertion in text inputs.
 * Used by both the new-comment input and the edit-comment textarea.
 */
export function useMentionInput(): UseMentionInputReturn {
  const [text, setText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  // Keep a ref to the latest text so callbacks always see the current value
  const textRef = useRef(text);
  textRef.current = text;

  // Reset highlight when mention dropdown visibility or query changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [showMentions, mentionQuery]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setText(value);

      const cursorPos = e.target.selectionStart ?? value.length;
      const textBeforeCursor = value.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(AT_MENTION_PATTERN);

      if (atMatch) {
        setMentionQuery(atMatch[1]);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    },
    []
  );

  const handleMentionSelect = useCallback((user: MentionableUser) => {
    const currentText = textRef.current;
    const cursorPos = inputRef.current?.selectionStart ?? currentText.length;
    const textBeforeCursor = currentText.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1) {
      const before = currentText.slice(0, atIndex);
      const after = currentText.slice(cursorPos);
      setText(`${before}@${user.email} ${after}`);
    }

    setShowMentions(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closeMentions = useCallback(() => {
    setShowMentions(false);
  }, []);

  return {
    text,
    setText,
    showMentions,
    mentionQuery,
    highlightedIndex,
    setHighlightedIndex,
    handleChange,
    handleMentionSelect,
    closeMentions,
    inputRef,
  };
}
