import { useCallback, useState } from 'react';
import type { KeyedMutator } from 'swr';
import type { Chart, ChartListResponse } from '@/hooks/api/useCharts';
import { useBulkDeleteCharts } from '@/hooks/api/useChart';
import type { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { toastSuccess, toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface UseChartSelectionArgs {
  /** Rows on screen (filtered + sorted page): Select All and the confirm text use them. */
  visibleCharts: Chart[];
  confirm: ReturnType<typeof useConfirmationDialog>['confirm'];
  deleteChart: (chartId: number) => Promise<unknown>;
  mutate: KeyedMutator<ChartListResponse>;
}

/** Row-menu "Select" mode on the chart list, plus bulk delete of the selection. */
export function useChartSelection({
  visibleCharts,
  confirm,
  deleteChart,
  mutate,
}: UseChartSelectionArgs) {
  const { trigger: bulkDeleteCharts } = useBulkDeleteCharts();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCharts, setSelectedCharts] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const enterSelectionMode = useCallback((chartId: number) => {
    setIsSelectionMode(true);
    setSelectedCharts(new Set([chartId]));
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedCharts(new Set());
  }, []);

  const toggleChartSelection = useCallback((chartId: number) => {
    setSelectedCharts((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(chartId)) {
        newSelection.delete(chartId);
      } else {
        newSelection.add(chartId);
      }
      return newSelection;
    });
  }, []);

  const selectAllCharts = useCallback(() => {
    setSelectedCharts(new Set(visibleCharts.map((chart) => chart.id)));
  }, [visibleCharts]);

  const deselectAllCharts = useCallback(() => {
    setSelectedCharts(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedCharts.size === 0) return;

    const chartTitles = visibleCharts
      .filter((chart) => selectedCharts.has(chart.id))
      .map((chart) => chart.title);

    const confirmMessage =
      selectedCharts.size === 1
        ? `This will permanently delete "${chartTitles[0]}". This action cannot be undone.`
        : `This will permanently delete ${selectedCharts.size} charts. This action cannot be undone.\n\nCharts to delete:\n${chartTitles.map((title) => `• ${title}`).join('\n')}`;

    const confirmed = await confirm({
      title: `Delete ${selectedCharts.size === 1 ? 'Chart' : 'Charts'}`,
      description: confirmMessage,
      confirmText: 'Delete',
      type: 'warning',
      testIdPrefix: 'chart-bulk-delete-confirm',
      onConfirm: () => {},
    });

    if (!confirmed) return;

    setIsBulkDeleting(true);

    try {
      // Try bulk delete first, fall back to individual deletes if bulk API doesn't exist
      try {
        await bulkDeleteCharts(Array.from(selectedCharts));
      } catch (bulkError) {
        // Fallback to individual deletions
        const deletePromises = Array.from(selectedCharts).map((chartId) => deleteChart(chartId));
        await Promise.all(deletePromises);
      }

      // chart_ids (plural) so a bulk delete can still be traced to the exact charts,
      // the same way single deletes carry chart_id.
      trackEvent(ANALYTICS_EVENTS.CHARTS_BULK_DELETED, {
        count: selectedCharts.size,
        chart_ids: Array.from(selectedCharts),
      });
      await mutate();
      toastSuccess.generic(
        `${selectedCharts.size} chart${selectedCharts.size === 1 ? '' : 's'} deleted successfully`
      );
      exitSelectionMode();
    } catch (error) {
      toastError.delete(
        error,
        `${selectedCharts.size} chart${selectedCharts.size === 1 ? '' : 's'}`
      );
    } finally {
      setIsBulkDeleting(false);
    }
    // `confirm` (from useConfirmationDialog) is a new function every render, same as in
    // the original page component — kept out of the deps array to match that memo exactly.
  }, [selectedCharts, visibleCharts, bulkDeleteCharts, deleteChart, mutate, exitSelectionMode]);

  return {
    isSelectionMode,
    selectedCharts,
    isBulkDeleting,
    enterSelectionMode,
    exitSelectionMode,
    toggleChartSelection,
    selectAllCharts,
    deselectAllCharts,
    handleBulkDelete,
  };
}
