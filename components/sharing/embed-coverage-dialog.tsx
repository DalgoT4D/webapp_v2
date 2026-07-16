'use client';

/**
 * Embed-time warning: adding a chart the container's audience can't see
 * standalone asks before exposing it. Also reused by the dashboard editor's
 * autosave 409 recovery. Branches off the verdicts: extendable + editable →
 * YES extends; extendable but view-only → request-Edit prompt, no YES;
 * informational-only exposure → YES just proceeds.
 */
import React, { useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { ChartCoverageVerdict } from '@/hooks/api/useResourceAccess';
import {
  summarizeCoverage,
  type CoverageDecision,
} from '@/components/sharing/coverage-confirm-utils';

interface EmbedCoverageDialogProps {
  open: boolean;
  /** The container the chart is being embedded into — e.g. the dashboard's title. */
  containerName: string;
  verdicts: ChartCoverageVerdict[];
  containerNoun?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  /** YES: extend the extendable-and-editable charts and/or proceed —
   * the caller composes its endpoint's confirm fields from this. */
  onConfirm: (decision: CoverageDecision) => void;
  /** The view-only branch's "Request Edit access" action (chart ids the
   * viewer lacks Edit on). Omitted → that branch shows Cancel only. */
  onRequestEdit?: (chartIds: number[]) => void;
}

export function EmbedCoverageDialog({
  open,
  containerName,
  verdicts,
  containerNoun = 'dashboard',
  isSubmitting = false,
  onCancel,
  onConfirm,
  onRequestEdit,
}: EmbedCoverageDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const summary = useMemo(() => summarizeCoverage(verdicts), [verdicts]);

  if (verdicts.length === 0) return null;

  const single = summary.chartCount === 1;
  const canExtend = summary.extendChartIds.length > 0;
  // View-only branch: there IS a closable gap, but this viewer can't close
  // any of it — offering YES would promise an extend the backend will 403.
  const editBlocked = !canExtend && summary.editBlockedTitles.length > 0;
  const editBlockedIds = verdicts
    .filter((v) => v.extendable && !v.viewer_can_edit)
    .map((v) => v.chart_id);

  const subject = single ? 'This chart' : `${summary.chartCount} charts`;
  const verb = single ? "isn't" : "aren't";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent
        data-testid="embed-coverage-dialog"
        className="sm:max-w-md"
        // Default emphasis on CANCEL — land the initial focus there.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Update permissions?</DialogTitle>
        </DialogHeader>

        <DialogDescription data-testid="embed-coverage-body" className="text-sm text-foreground">
          {subject} {verb} visible to some viewers of &apos;{containerName}&apos; (
          {summary.audienceLabel}).{' '}
          {editBlocked ? (
            <>
              You need Edit access on the {single ? 'chart' : 'charts'} to share{' '}
              {single ? 'it' : 'them'} with {summary.audienceLabel} — request Edit access or ask the
              chart&apos;s owner.
            </>
          ) : canExtend ? (
            <>
              Add {summary.audienceLabel} to {single ? "this chart's" : "these charts'"} share list?
              {summary.hasResidualExposure && (
                <> Exposure that can&apos;t be extended stays visible inside the {containerNoun}.</>
              )}
            </>
          ) : (
            <>
              {single ? 'It' : 'They'} will still be shown inside this {containerNoun} — continue?
            </>
          )}
        </DialogDescription>

        {!single && (
          <ul
            data-testid="embed-coverage-charts"
            className="max-h-40 list-disc list-inside overflow-y-auto text-sm text-muted-foreground"
          >
            {verdicts.map((v) => (
              <li key={v.chart_id}>{v.title}</li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-3">
          <Button
            ref={cancelRef}
            data-testid="embed-coverage-cancel"
            variant="cancel"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            CANCEL
          </Button>
          {editBlocked ? (
            onRequestEdit && (
              <Button
                data-testid="embed-coverage-request-edit"
                variant="primary"
                onClick={() => onRequestEdit(editBlockedIds)}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                REQUEST EDIT ACCESS
              </Button>
            )
          ) : (
            <Button
              data-testid="embed-coverage-yes"
              variant="primary"
              onClick={() => onConfirm({ extendChartIds: summary.extendChartIds, proceed: true })}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              YES
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
