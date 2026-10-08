'use client';

import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { MentionDropdown } from '@/components/reports/comments/MentionDropdown';
import type { CommentEditorState } from '@/components/reports/comments/useCommentEditor';

interface CommentEditFormProps {
  commentId: number;
  editor: CommentEditorState;
}

/** The edit box that replaces a comment's text while its author edits it. */
export function CommentEditForm({ commentId, editor }: CommentEditFormProps) {
  const editListboxId = `edit-mention-listbox-${commentId}`;
  const { filteredUsers, highlightedIndex } = editor;

  return (
    <>
      <div className="relative">
        <MentionDropdown
          filteredUsers={filteredUsers}
          onSelect={editor.handleMentionSelect}
          visible={editor.showMentions}
          highlightedIndex={highlightedIndex}
          onHighlightChange={editor.setHighlightedIndex}
          listboxId={editListboxId}
        />
        <textarea
          ref={editor.inputRef as RefObject<HTMLTextAreaElement>}
          data-testid={`comment-edit-textarea-${commentId}`}
          value={editor.editText}
          onChange={editor.handleChange}
          onKeyDown={editor.handleKeyDown}
          role="combobox"
          aria-expanded={editor.showMentions}
          aria-controls={editListboxId}
          aria-activedescendant={
            highlightedIndex >= 0 && filteredUsers[highlightedIndex]
              ? `${editListboxId}-option-${filteredUsers[highlightedIndex].email}`
              : undefined
          }
          className="w-full text-sm border rounded-md p-2 min-h-[60px] resize-none bg-background outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <Button
          variant="outline"
          size="sm"
          className="text-destructive border-destructive hover:bg-destructive/10 uppercase text-xs font-semibold"
          data-testid={`cancel-edit-btn-${commentId}`}
          onClick={editor.handleCancelEdit}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          className="uppercase text-xs font-semibold"
          data-testid={`save-edit-btn-${commentId}`}
          onClick={editor.handleSave}
          disabled={!editor.editText.trim() || editor.isSaving}
        >
          Save
        </Button>
      </div>
    </>
  );
}
