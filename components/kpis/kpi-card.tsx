'use client';

import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { KPISummary, RAGStatus } from '@/types/kpis';
import { RAG_COLORS } from '@/types/kpis';

interface KPICardProps {
  kpi: KPISummary;
  sparklineConfig?: Record<string, any>;
  onClick: () => void;
}

function formatValue(value: number | null): string {
  if (value === null) return '—';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function Sparkline({ config }: { config: Record<string, any> }) {
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
      <div className="h-12 flex items-center text-xs text-muted-foreground">No trend data</div>
    );
  }

  return <div ref={chartRef} className="h-12 w-full" />;
}

export function KPICard({ kpi, sparklineConfig, onClick }: KPICardProps) {
  const rag = kpi.rag_status as RAGStatus | null;
  const ragInfo = rag ? RAG_COLORS[rag] : null;

  const popChange = kpi.period_over_period_change;
  const isPositiveChange = popChange !== null && popChange > 0;
  const isNegativeChange = popChange !== null && popChange < 0;

  return (
    <div
      onClick={onClick}
      className="bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow space-y-3"
    >
      {/* Header: name + RAG badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-700 truncate">{kpi.name}</h3>
        {ragInfo && (
          <Badge
            variant="outline"
            className={`${ragInfo.bg} ${ragInfo.text} border-0 text-xs shrink-0`}
          >
            {ragInfo.label}
          </Badge>
        )}
      </div>

      {/* Value + target */}
      <div>
        <div className="text-2xl font-bold text-gray-900">{formatValue(kpi.current_value)}</div>
        {kpi.target_value !== null && (
          <div className="text-xs text-muted-foreground">
            Target: {formatValue(kpi.target_value)}
            {kpi.achievement_pct !== null && <span className="ml-1">({kpi.achievement_pct}%)</span>}
          </div>
        )}
      </div>

      {/* Sparkline */}
      <Sparkline config={sparklineConfig || {}} />

      {/* Footer: change + last updated */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          {popChange !== null ? (
            <>
              {isPositiveChange && <TrendingUp className="h-3 w-3 text-green-600" />}
              {isNegativeChange && <TrendingDown className="h-3 w-3 text-red-600" />}
              {popChange === 0 && <Minus className="h-3 w-3" />}
              <span
                className={
                  isPositiveChange ? 'text-green-600' : isNegativeChange ? 'text-red-600' : ''
                }
              >
                {popChange > 0 ? '+' : ''}
                {popChange}%
              </span>
            </>
          ) : (
            <span>—</span>
          )}
        </div>
        <span>{new Date(kpi.updated_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
