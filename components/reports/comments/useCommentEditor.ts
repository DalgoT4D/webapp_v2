import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useMentionInput } from '@/hooks/useMentionInput';
import { filterMentionableUsers } from '@/components/reports/logic/comments';
import { MENTION_DROPDOWN_LIMIT } from '@/components/reports/constants';
import { handleMentionListKey } from '@/components/reports/comments/mention-keyboard';
import type { Comment, MentionableUser } from '@/types/comments';

/** Edit-in-place state for one comment: text with @mentions, Save/Cancel. */
export function useCommentEditor(
  comment: Comment,
  mentionableUsers: MentionableUser[],
  onSaveEdit: (commentId: number, content: string) => Promise<void>
) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    text: editText,
    setText: setEditText,
    showMentions,
    mentionQuery,
    highlightedIndex,
    setHighlightedIndex,
    handleChange,
    handleMentionSelect,
    closeMentions,
    inputRef,
  } = useMentionInput();

  // Compute filtered users for edit mention dropdown
  const filteredUsers = useMemo(
    () => filterMentionableUsers(mentionableUsers, mentionQuery, MENTION_DROPDOWN_LIMIT),
    [mentionableUsers, mentionQuery]
  );

  // Keyboard handler for edit textarea mention navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      handleMentionListKey(e, {
        isListOpen: showMentions,
        users: filteredUsers,
        highlightedIndex,
        setHighlightedIndex,
        onSelect: handleMentionSelect,
        onClose: closeMentions,
      });
    },
    [
      showMentions,
      filteredUsers,
      highlightedIndex,
      handleMentionSelect,
      closeMentions,
      setHighlightedIndex,
    ]
  );

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setEditText(comment.content);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [comment.content, setEditText, inputRef]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditText('');
    closeMentions();
  }, [setEditText, closeMentions]);

  const handleSave = useCallback(async () => {
    const content = editText.trim();
    if (!content || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveEdit(comment.id, content);
      setIsEditing(false);
      setEditText('');
    } finally {
      setIsSaving(false);
    }
  }, [editText, isSaving, comment.id, onSaveEdit, setEditText]);

  return {
    isEditing,
    isSaving,
    editText,
    showMentions,
    highlightedIndex,
    setHighlightedIndex,
    filteredUsers,
    inputRef,
    handleChange,
    handleMentionSelect,
    handleKeyDown,
    handleStartEdit,
    handleCancelEdit,
    handleSave,
  };
}

export type CommentEditorState = ReturnType<typeof useCommentEditor>;
