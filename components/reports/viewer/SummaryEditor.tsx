'use client';

import { Pencil, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CommentPopover } from '@/components/reports/comment-popover';
import type { CommentIconState } from '@/types/comments';
import type { SummaryEditorState } from '@/components/reports/viewer/useSummaryEditor';

interface SummaryEditorProps {
  reportId: number;
  canEdit: boolean;
  commentState: CommentIconState;
  onCommentStateChange: () => void;
  autoOpenComments: boolean;
  canModerateComments: boolean;
  lastModifiedBy: string | undefined;
  editor: SummaryEditorState;
}

/** "Executive Summary" card above the report canvas: text, edit/save/cancel and its comment thread. */
export function SummaryEditor({
  reportId,
  canEdit,
  commentState,
  onCommentStateChange,
  autoOpenComments,
  canModerateComments,
  lastModifiedBy,
  editor,
}: SummaryEditorProps) {
  const { summaryDraft, isSaving, isEditingSummary } = editor;

  return (
    <div className="flex-shrink-0 px-6 pt-4 pb-2">
      <div className="border rounded-lg p-5 bg-background relative">
        {canEdit && (
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <CommentPopover
              snapshotId={reportId}
              targetType="summary"
              state={commentState}
              triggerClassName="h-8 w-8"
              onStateChange={onCommentStateChange}
              autoOpen={autoOpenComments}
              canModerate={canModerateComments}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              data-testid="summary-edit-btn"
              aria-label="Edit summary"
              onClick={editor.handleStartEditing}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="text-lg font-semibold">Executive Summary</h2>
          {lastModifiedBy && (
            <span
              className="text-xs text-muted-foreground flex items-center gap-1"
              data-testid="report-last-modified-by"
            >
              <User className="w-3 h-3" />
              Last updated by: {lastModifiedBy}
            </span>
          )}
        </div>
        <Textarea
          data-testid="report-summary-textarea"
          value={summaryDraft}
          onChange={(e) => editor.handleDraftChange(e.target.value)}
          readOnly={!isEditingSummary}
          placeholder="Add your notes here"
          rows={2}
          className={`resize-y border-none shadow-none p-0 focus-visible:ring-0 text-sm text-muted-foreground placeholder:text-muted-foreground ${!isEditingSummary ? 'cursor-default' : ''}`}
        />
        {canEdit && isEditingSummary && (
          <div className="flex justify-end gap-2 mt-2">
            <Button
              data-testid="report-cancel-edit-btn"
              variant="destructive"
              size="sm"
              onClick={editor.handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              data-testid="report-save-btn"
              variant="primary"
              size="sm"
              onClick={editor.handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
