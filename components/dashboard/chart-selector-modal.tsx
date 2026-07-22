'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useCharts } from '@/hooks/api/useCharts';
import { StaticChartPreview } from '@/components/charts/StaticChartPreview';
import { OverflowTooltip } from '@/components/ui/overflow-tooltip';
import { Loader2, Search, Plus } from 'lucide-react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { toastSuccess, toastError } from '@/lib/toast';
import { createAccessRequest } from '@/hooks/api/useAccessRequests';
import { EmbedCoverageDialog } from '@/components/sharing/embed-coverage-dialog';
import type { CoverageDecision } from '@/components/sharing/coverage-confirm-utils';
import type { ChartCoverageVerdict } from '@/hooks/api/useResourceAccess';

interface ChartCoverageResponse {
  dashboard_id: number;
  covered: boolean;
  charts: ChartCoverageVerdict[];
}

interface ChartSelectorModalProps {
  open: boolean;
  onClose: () => void;
  /** `coverage` is set when the pick went through the embed warning — the
   * caller must carry it into its next save, or the server 409s the tile. */
  onSelect: (chartId: number, coverage?: CoverageDecision) => void;
  excludedChartIds?: number[];
  /** Enables the embed-time coverage pre-flight. Omitted, picks embed
   * directly — the server still validates at save time. */
  dashboardId?: number;
  /** Names the container in the warning copy. */
  dashboardTitle?: string;
}

export function ChartSelectorModal({
  open,
  onClose,
  onSelect,
  excludedChartIds = [],
  dashboardId,
  dashboardTitle,
}: ChartSelectorModalProps) {
  const [chartSearch, setChartSearch] = useState('');
  // The pick currently held behind the embed warning; the dialog's decision
  // releases or aborts it.
  const [pendingPick, setPendingPick] = useState<{
    chartId: number;
    verdicts: ChartCoverageVerdict[];
  } | null>(null);
  const [checkingChartId, setCheckingChartId] = useState<number | null>(null);
  const [isRequestingEdit, setIsRequestingEdit] = useState(false);

  const { data: charts, isLoading: chartsLoading } = useCharts({ search: chartSearch });

  const completeSelect = (chartId: number, coverage?: CoverageDecision) => {
    setPendingPick(null);
    onSelect(chartId, coverage);
    onClose();
    setChartSearch('');
  };

  const handleSelectChart = async (chartId: number) => {
    if (excludedChartIds.includes(chartId)) return;
    if (checkingChartId !== null) return; // one pre-flight at a time

    // No saved dashboard yet → nothing to check coverage against.
    if (!dashboardId) {
      completeSelect(chartId, undefined);
      return;
    }

    setCheckingChartId(chartId);
    try {
      const response: ChartCoverageResponse = await apiGet(
        `/api/dashboards/${dashboardId}/chart-coverage/?chart_id=${chartId}`
      );
      const gaps = (response.charts ?? []).filter((v) => !v.covered);
      if (gaps.length === 0) {
        completeSelect(chartId, undefined);
      } else {
        setPendingPick({ chartId, verdicts: gaps });
      }
    } catch (error) {
      // Fail open: the pre-flight is a courtesy — update_dashboard
      // re-validates server-side and 409s if the embed under-covers.
      console.error('Chart coverage pre-flight failed:', error);
      completeSelect(chartId, undefined);
    } finally {
      setCheckingChartId(null);
    }
  };

  const handleCoverageConfirm = (decision: CoverageDecision) => {
    if (!pendingPick) return;
    completeSelect(pendingPick.chartId, decision);
  };

  const handleRequestEdit = async (chartIds: number[]) => {
    setIsRequestingEdit(true);
    try {
      await Promise.all(
        chartIds.map((id) => createAccessRequest('chart', id, { requested_permission: 'edit' }))
      );
      toastSuccess.generic("Edit access requested — the chart's owner will be notified.");
      setPendingPick(null); // the pick stays aborted until access arrives
    } catch (error) {
      toastError.api(error, 'request edit access');
    } finally {
      setIsRequestingEdit(false);
    }
  };

  const handleClose = () => {
    setPendingPick(null);
    onClose();
    setChartSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add Chart</DialogTitle>
        </DialogHeader>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search charts..."
              value={chartSearch}
              onChange={(e) => setChartSearch(e.target.value)}
              className="w-full pl-10"
            />
          </div>
          <Link href="/charts/new?from=dashboard">
            <Button
              variant="outline"
              className="flex items-center gap-2 whitespace-nowrap border-dashed border-2 hover:border-solid hover:bg-blue-50 hover:border-blue-300 transition-all font-medium uppercase"
            >
              <Plus className="w-4 h-4" />
              CREATE NEW CHART
            </Button>
          </Link>
        </div>

        <ScrollArea className="h-[600px] pr-4">
          {chartsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">Loading charts...</span>
            </div>
          ) : charts && charts.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {charts.map((chart) => {
                const isAlreadyAdded = excludedChartIds.includes(chart.id);
                const isChecking = checkingChartId === chart.id;
                return (
                  <div
                    key={chart.id}
                    className={`border rounded-lg p-4 transition-all duration-200 ${
                      isAlreadyAdded
                        ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200'
                        : 'cursor-pointer hover:bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => handleSelectChart(chart.id)}
                  >
                    <div className="h-36 mb-3">
                      <StaticChartPreview chartType={chart.chart_type} />
                    </div>
                    <div className="text-center">
                      <OverflowTooltip
                        text={chart.title}
                        className="text-sm font-medium mb-1"
                        tooltipAlign="center"
                      />
                      <p className="text-xs text-gray-500 capitalize">{chart.chart_type}</p>
                      {isAlreadyAdded && (
                        <p className="text-xs text-orange-600 font-medium mt-1">Already added</p>
                      )}
                      {isChecking && (
                        <p className="text-xs text-muted-foreground mt-1">Checking access…</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                {chartSearch ? 'No charts found matching your search.' : 'No charts available yet.'}
              </div>
              {!chartSearch && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">Get started by creating your first chart</p>
                  <Link href="/charts/new?from=dashboard">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-dashed border-2 hover:border-solid hover:bg-blue-50 hover:border-blue-300 transition-all font-medium uppercase"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      CREATE YOUR FIRST CHART
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {pendingPick && (
          <EmbedCoverageDialog
            open
            containerName={dashboardTitle || 'this dashboard'}
            verdicts={pendingPick.verdicts}
            isSubmitting={isRequestingEdit}
            onCancel={() => setPendingPick(null)}
            onConfirm={handleCoverageConfirm}
            onRequestEdit={handleRequestEdit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
