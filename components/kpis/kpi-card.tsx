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
import { Download, FileImage, FileText, MoreVertical } from 'lucide-react';
import { RAG_COLORS } from '@/types/kpis';
import { toast } from 'sonner';
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

function formatValue(v: number | null | undefined): string {
  if (v === null || v === undefined) return '\u2014';
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
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
      toast.success('Downloaded successfully');
    } catch {
      toast.error('Failed to download');
    }
  }, [name]);

  const handleDownloadCSV = useCallback(() => {
    if (!periods || periods.length === 0) {
      toast.error('No data to export');
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
    toast.success('CSV exported successfully');
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
      className={`bg-white flex flex-col relative group ${borderless ? '' : 'border rounded-lg hover:shadow-md transition-shadow'} ${className || ''}`}
    >
      {/* Download toolbar — visible on hover (only when not in menu mode) */}
      {showDownload && !downloadInMenu && !isLoading && (
        <div className="absolute top-2 right-12 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex gap-1 bg-white/90 backdrop-blur rounded-md shadow-sm p-1">
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
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2 border-b">
        <div className="min-w-0">
          <h3
            className={`font-semibold text-gray-900 truncate ${onClick ? 'cursor-pointer hover:text-teal-700 hover:underline' : ''}`}
            onClick={onClick}
          >
            {name}
          </h3>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
            <div className="text-4xl font-bold text-gray-900">{formatValue(currentValue)}</div>
            {targetValue !== null && targetValue !== undefined && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Target: {formatValue(targetValue)}
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
      <div className="px-4 pb-3 flex-1">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <EChartsRenderer config={echartsConfig || {}} height="h-32" />
        )}
      </div>

      {/* Footer */}
      <div className="mx-4 border-t" />
      <div className="px-4 py-1.5">
        <span className="text-xs text-muted-foreground">
          {(() => {
            if (dataLastDate) {
              const d = parseISO(dataLastDate);
              if (isValid(d)) return `Data as of ${formatDate(d, 'd MMMM yyyy')}`;
            }
            return `Updated ${formatDistanceToNow(new Date(updatedAt))} ago`;
          })()}
        </span>
      </div>
    </div>
  );
}
