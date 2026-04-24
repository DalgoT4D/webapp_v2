'use client';

import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useKPITrend } from '@/hooks/api/useKPIs';
import type { KPISummary, RAGStatus } from '@/types/kpis';
import { RAG_COLORS, TIME_GRAIN_OPTIONS, METRIC_TYPE_TAG_OPTIONS } from '@/types/kpis';

interface KPIDetailDrawerProps {
  kpi: KPISummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (kpiId: number) => void;
}

function TrendChart({ config }: { config: Record<string, any> }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !config || Object.keys(config).length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    chartInstance.current.setOption(config, true);

    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [config]);

  useEffect(() => {
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!config || Object.keys(config).length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground border rounded-lg">
        No trend data available. Ensure a time dimension column is configured.
      </div>
    );
  }

  return <div ref={chartRef} className="h-64 w-full" />;
}

function formatValue(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function getTimeGrainLabel(grain: string): string {
  return TIME_GRAIN_OPTIONS.find((o) => o.value === grain)?.label || grain;
}

function getMetricTypeLabel(tag: string | null): string {
  if (!tag) return '—';
  return METRIC_TYPE_TAG_OPTIONS.find((o) => o.value === tag)?.label || tag;
}

export function KPIDetailDrawer({ kpi, open, onOpenChange, onEdit }: KPIDetailDrawerProps) {
  const { echartsConfig, isLoading: trendLoading } = useKPITrend(kpi?.id || null);

  if (!kpi) return null;

  const rag = kpi.rag_status as RAGStatus | null;
  const ragInfo = rag ? RAG_COLORS[rag] : null;
  const popChange = kpi.period_over_period_change;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[460px] sm:max-w-[460px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl">{kpi.name}</SheetTitle>
            <Button variant="outline" size="sm" onClick={() => onEdit(kpi.id)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Value section */}
          <div className="space-y-1">
            <div className="text-3xl font-bold text-gray-900">{formatValue(kpi.current_value)}</div>
            <div className="flex items-center gap-3">
              {kpi.target_value !== null && (
                <span className="text-sm text-muted-foreground">
                  Target: {formatValue(kpi.target_value)}
                </span>
              )}
              {ragInfo && (
                <Badge variant="outline" className={`${ragInfo.bg} ${ragInfo.text} border-0`}>
                  {ragInfo.label}
                </Badge>
              )}
              {kpi.achievement_pct !== null && (
                <span className="text-sm text-muted-foreground">({kpi.achievement_pct}%)</span>
              )}
            </div>
            {popChange !== null && (
              <div className="flex items-center gap-1 text-sm">
                {popChange > 0 && <TrendingUp className="h-4 w-4 text-green-600" />}
                {popChange < 0 && <TrendingDown className="h-4 w-4 text-red-600" />}
                {popChange === 0 && <Minus className="h-4 w-4" />}
                <span
                  className={popChange > 0 ? 'text-green-600' : popChange < 0 ? 'text-red-600' : ''}
                >
                  {popChange > 0 ? '+' : ''}
                  {popChange}% vs previous period
                </span>
              </div>
            )}
          </div>

          {/* Trend chart */}
          <div>
            <h4 className="text-sm font-medium mb-2">Trend</h4>
            {trendLoading ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                Loading trend...
              </div>
            ) : (
              <TrendChart config={echartsConfig || {}} />
            )}
          </div>

          {/* Configuration details */}
          <div>
            <h4 className="text-sm font-medium mb-2">Configuration</h4>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted-foreground">Metric</span>
              <span>{kpi.metric_name}</span>

              <span className="text-muted-foreground">Direction</span>
              <span className="capitalize">
                {kpi.direction === 'increase' ? 'Higher is better' : 'Lower is better'}
              </span>

              <span className="text-muted-foreground">Time Grain</span>
              <span>{getTimeGrainLabel(kpi.time_grain)}</span>

              <span className="text-muted-foreground">Metric Type</span>
              <span>{getMetricTypeLabel(kpi.metric_type_tag)}</span>

              {kpi.program_tags.length > 0 && (
                <>
                  <span className="text-muted-foreground">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {kpi.program_tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
