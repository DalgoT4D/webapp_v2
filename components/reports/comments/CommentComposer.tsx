'use client';

import type { RefObject } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MentionDropdown } from '@/components/reports/comments/MentionDropdown';
import type { CommentComposerState } from '@/components/reports/comments/useCommentComposer';

interface CommentComposerProps {
  composer: CommentComposerState;
  /** A comment list is shown above → top border. */
  hasCommentsAbove: boolean;
}

/** "Add a comment or @tag someone." input with the mention list and the send button. */
export function CommentComposer({ composer, hasCommentsAbove }: CommentComposerProps) {
  const { filteredMentionUsers, highlightedIndex, hasDraft } = composer;

  return (
    <div className={cn('p-3 flex-shrink-0', hasCommentsAbove && 'border-t relative')}>
      <div>
        <MentionDropdown
          filteredUsers={filteredMentionUsers}
          onSelect={composer.handleMentionSelect}
          visible={composer.showMentions}
          highlightedIndex={highlightedIndex}
          onHighlightChange={composer.setHighlightedIndex}
          listboxId="mention-listbox"
        />
        <div className="flex items-center gap-2">
          <input
            ref={composer.inputRef as RefObject<HTMLInputElement>}
            type="text"
            data-testid="comment-input"
            value={composer.draft}
            onChange={composer.handleChange}
            onKeyDown={composer.handleKeyDown}
            placeholder="Add a comment or @tag someone."
            role="combobox"
            aria-expanded={composer.showMentions}
            aria-controls="mention-listbox"
            aria-activedescendant={
              highlightedIndex >= 0 && filteredMentionUsers[highlightedIndex]
                ? `mention-listbox-option-${filteredMentionUsers[highlightedIndex].email}`
                : undefined
            }
            className="flex-1 h-8 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            data-testid="comment-submit-btn"
            onClick={composer.handleSubmit}
            disabled={!hasDraft || composer.isSubmitting}
            className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
              hasDraft ? 'bg-primary text-white hover:opacity-90' : 'bg-muted text-muted-foreground'
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
