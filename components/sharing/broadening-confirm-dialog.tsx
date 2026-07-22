'use client';

/**
 * Dashboard-broadening warning: widening a container's audience past its
 * inner charts' own access lists the affected charts by name; CANCEL is the
 * default, YES = extend-all where possible. Fires on every widening path
 * that returns requires_confirmation. Capability-driven off the verdicts —
 * no rtype conditionals.
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

interface BroadeningConfirmDialogProps {
  open: boolean;
  /** The container being shared/widened — e.g. the dashboard's title. */
  resourceName: string;
  verdicts: ChartCoverageVerdict[];
  /** Noun for the copy ("charts in this dashboard…"). */
  containerNoun?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  /** YES: extendChartIds = extendable charts this viewer can edit (may be
   * empty); proceed is always true. */
  onConfirm: (decision: CoverageDecision) => void;
}

export function BroadeningConfirmDialog({
  open,
  resourceName,
  verdicts,
  containerNoun = 'dashboard',
  isSubmitting = false,
  onCancel,
  onConfirm,
}: BroadeningConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const summary = useMemo(() => summarizeCoverage(verdicts), [verdicts]);

  if (verdicts.length === 0) return null;

  const chartNoun = summary.chartCount === 1 ? 'chart' : 'charts';
  const verb = summary.chartCount === 1 ? "isn't" : "aren't";
  const canExtend = summary.extendChartIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent
        data-testid="broadening-confirm-dialog"
        className="sm:max-w-md"
        // Default emphasis on CANCEL — land the initial focus there.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Share &quot;{resourceName}&quot;</DialogTitle>
        </DialogHeader>

        <DialogDescription
          data-testid="broadening-confirm-body"
          className="text-sm text-foreground"
        >
          Are you sure you want to share &quot;{resourceName}&quot;? {summary.chartCount}{' '}
          {chartNoun} in this {containerNoun} {verb} shared with {summary.audienceLabel}.
          {canExtend && <> Extend all {summary.extendChartIds.length}.</>}
          {summary.hasResidualExposure && (
            <>
              {' '}
              {canExtend ? 'Charts that can’t be extended' : `The ${chartNoun}`} will still be
              visible inside it.
            </>
          )}
        </DialogDescription>

        <ul
          data-testid="broadening-confirm-charts"
          className="max-h-40 list-disc list-inside overflow-y-auto text-sm text-muted-foreground"
        >
          {verdicts.map((v) => (
            <li key={v.chart_id}>{v.title}</li>
          ))}
        </ul>

        <div className="flex justify-end gap-3">
          <Button
            ref={cancelRef}
            data-testid="broadening-confirm-cancel"
            variant="cancel"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            CANCEL
          </Button>
          <Button
            data-testid="broadening-confirm-yes"
            variant="primary"
            onClick={() => onConfirm({ extendChartIds: summary.extendChartIds, proceed: true })}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            YES
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
