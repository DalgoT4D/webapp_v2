'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileImage, FileText, Maximize2, MoreVertical } from 'lucide-react';
import { useFullscreen } from '@/hooks/useFullscreen';
import { RAG_COLORS } from '@/types/kpis';
import { toastSuccess, toastError } from '@/lib/toast';
import { formatMetricValue } from '@/lib/formatters';
import { OverflowTooltip } from '@/components/ui/overflow-tooltip';
import type { RAGStatus } from '@/types/kpis';
import { formatDistanceToNow, format as formatDate, parseISO, isValid } from 'date-fns';

function EChartsRenderer({
  config,
  height = 'h-32',
}: {
  config: Record<string, any>;
  height?: string;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !config || Object.keys(config).length === 0) return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
    }
    chartInstance.current = echarts.init(chartRef.current);
    chartInstance.current.setOption(config);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    // Also observe container size changes (for dashboard grid resizing)
    const observer = new ResizeObserver(handleResize);
    if (chartRef.current) observer.observe(chartRef.current);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [config]);

  if (!config || Object.keys(config).length === 0) {
    return (
      <div className={`${height} flex items-center justify-center text-xs text-muted-foreground`}>
        No trend data
      </div>
    );
  }

  return <div ref={chartRef} className={`${height} w-full`} />;
}

const GRAIN_LABEL: Record<string, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
};

export interface KPICardData {
  currentValue: number | null | undefined;
  targetValue: number | null | undefined;
  ragStatus: RAGStatus | null;
  popChange: number | null;
  direction: string;
  timeGrain: string;
  echartsConfig: Record<string, any> | null;
  dataLastDate: string | null | undefined;
  updatedAt: string;
  isLoading: boolean;
  periods?: { period: string; period_date?: string | null; value: number | null }[];
}

interface KPICardProps {
  name: string;
  subtitle?: string;
  data: KPICardData;
  headerActions?: React.ReactNode;
  menuItems?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  borderless?: boolean;
  showDownload?: boolean;
  /** When true, download options appear in the header ⋮ menu instead of hover toolbar */
  downloadInMenu?: boolean;
  /** When true, shows a fullscreen toggle button (used on dashboards) */
  showFullscreen?: boolean;
}

export function KPICard({
  name,
  subtitle,
  data,
  headerActions,
  menuItems,
  onClick,
  className,
  borderless,
  showDownload = true,
  downloadInMenu,
  showFullscreen,
}: KPICardProps) {
  const {
    currentValue,
    targetValue,
    ragStatus,
    popChange,
    direction,
    timeGrain,
    echartsConfig,
    dataLastDate,
    updatedAt,
    isLoading,
    periods,
  } = data;

  const cardRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen('chart');

  const handleToggleFullscreen = useCallback(() => {
    if (cardRef.current) toggleFullscreen(cardRef.current);
  }, [toggleFullscreen]);

  const ragInfo = ragStatus ? RAG_COLORS[ragStatus] : null;

  const handleDownloadPNG = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const { default: html2canvas } = await import('html2canvas-pro');
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `kpi-${name}.png`;
      link.click();
      toastSuccess.exported(name, 'png');
    } catch {
      toastError.api(null, 'Failed to download');
    }
  }, [name]);

  const handleDownloadCSV = useCallback(() => {
    if (!periods || periods.length === 0) {
      toastError.api(null, 'No data to export');
      return;
    }
    const header = 'Period,Period Date,Value\n';
    const rows = periods
      .map((p) => `"${p.period}","${p.period_date ?? ''}",${p.value ?? ''}`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kpi-${name}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toastSuccess.exported(name, 'csv');
  }, [name, periods]);

  const isPositiveChange =
    popChange !== null &&
    ((direction === 'increase' && popChange > 0) || (direction === 'decrease' && popChange < 0));
  const isNegativeChange =
    popChange !== null &&
    ((direction === 'increase' && popChange < 0) || (direction === 'decrease' && popChange > 0));

  return (
    <div
      ref={cardRef}
      className={`bg-white flex flex-col relative group ${borderless ? '' : 'border rounded-lg hover:shadow-md transition-shadow'} ${isFullscreen ? '!h-screen !w-screen p-4' : ''} ${onClick ? 'cursor-pointer' : ''} ${className || ''}`}
      onClick={onClick}
    >
      {/* Hover toolbar (download + fullscreen) */}
      {((showDownload && !downloadInMenu && !isLoading) || showFullscreen) && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex gap-1 bg-white/90 backdrop-blur rounded-md shadow-sm p-1">
            {showDownload && !downloadInMenu && !isLoading && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Download">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleDownloadPNG} className="cursor-pointer">
                    <FileImage className="w-4 h-4 mr-2" />
                    Download as PNG
                  </DropdownMenuItem>
                  {periods && periods.length > 0 && (
                    <DropdownMenuItem onClick={handleDownloadCSV} className="cursor-pointer">
                      <FileText className="w-4 h-4 mr-2" />
                      Export Data as CSV
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {showFullscreen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleFullscreen}
                className="h-7 w-7 p-0"
                title="Fullscreen"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2 border-b">
        <div className="min-w-0">
          <OverflowTooltip text={name} className="font-semibold text-gray-900" />
          {subtitle && (
            <OverflowTooltip text={subtitle} className="text-xs text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {ragInfo && (
            <Badge variant="outline" className={`${ragInfo.bg} ${ragInfo.text} border-0 text-xs`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${ragInfo.dot}`} />
              {ragInfo.label}
            </Badge>
          )}
          {downloadInMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 p-0">
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {menuItems}
                <DropdownMenuItem onClick={handleDownloadPNG} className="cursor-pointer">
                  <FileImage className="w-4 h-4 mr-2" />
                  Download as PNG
                </DropdownMenuItem>
                {periods && periods.length > 0 && (
                  <DropdownMenuItem onClick={handleDownloadCSV} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Export Data as CSV
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            headerActions
          )}
        </div>
      </div>

      {/* Value section */}
      <div className="px-4 pt-3 pb-2">
        {isLoading ? (
          <Skeleton className="h-10 w-28" />
        ) : (
          <>
            <div className="text-4xl font-bold text-gray-900">
              {formatMetricValue(currentValue)}
            </div>
            {targetValue !== null && targetValue !== undefined && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Target: {formatMetricValue(targetValue)}
              </p>
            )}
            {popChange !== null && (
              <p
                className={`text-sm font-medium mt-1 ${
                  isPositiveChange
                    ? 'text-green-600'
                    : isNegativeChange
                      ? 'text-red-600'
                      : 'text-muted-foreground'
                }`}
              >
                {popChange > 0 ? '↑' : popChange < 0 ? '↓' : '—'} {popChange > 0 ? '+' : ''}
                {popChange.toFixed(1)}% from last {GRAIN_LABEL[timeGrain] || 'period'}
              </p>
            )}
          </>
        )}
      </div>

      {/* Chart */}
      <div className="px-4 pb-3 flex-1 min-h-0">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <EChartsRenderer config={echartsConfig || {}} height="h-full" />
        )}
      </div>

      {/* Footer */}
      <div className="mx-4 border-t" />
      <div className="px-4 py-1.5">
        {isLoading ? (
          <Skeleton className="h-3 w-32" />
        ) : (
          <span className="text-xs text-muted-foreground">
            {dataLastDate ? `Data as of ${dataLastDate}` : 'Data not yet available'}
          </span>
        )}
      </div>
    </div>
  );
}
