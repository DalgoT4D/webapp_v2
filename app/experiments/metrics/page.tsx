'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useMetricsData } from '../_lib/metrics-context';
import { MetricCard } from './MetricCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RagStatus } from '../_lib/types';

type FilterTab = 'all' | RagStatus;

const RAG_LABELS: Record<RagStatus, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  below_target: 'Below Target',
};

export default function MetricsDashboardPage() {
  const parsedData = useMetricsData();
  const [filter, setFilter] = useState<FilterTab>('all');

  const metrics = parsedData?.metrics ?? [];
  const programme = parsedData?.programme;

  const counts = useMemo(() => {
    const onTrack = metrics.filter((m) => m.ragStatus === 'on_track').length;
    const atRisk = metrics.filter((m) => m.ragStatus === 'at_risk').length;
    const belowTarget = metrics.filter((m) => m.ragStatus === 'below_target').length;
    return {
      total: metrics.length,
      onTrack,
      atRisk,
      belowTarget,
    };
  }, [metrics]);

  const filteredMetrics = useMemo(() => {
    if (filter === 'all') return metrics;
    return metrics.filter((m) => m.ragStatus === filter);
  }, [metrics, filter]);

  const lastUpdated = programme?.last_updated ?? '23 March 2026';

  if (!parsedData && metrics.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 border-b bg-background">
          <div className="flex items-center justify-between p-6">
            <div>
              <h1 className="text-3xl font-bold">My Metrics</h1>
              <p className="text-muted-foreground mt-1">Care Companion Program · Noora Health</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <p className="text-muted-foreground">
              No metrics configured. Go to configuration to define your programme metrics.
            </p>
            <Link href="/experiments/metrics/setup">
              <Button
                variant="ghost"
                className="text-white hover:opacity-90 shadow-xs"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                View configuration →
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="metrics-dashboard" className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between mb-4 p-6 pb-0">
          <div>
            <h1 className="text-3xl font-bold">My Metrics</h1>
            <p className="text-muted-foreground mt-1">
              {programme?.name ?? 'Care Companion Program'} ·{' '}
              {programme?.organisation ?? 'Noora Health'}
            </p>
          </div>
          <div className="text-sm text-muted-foreground">Last updated: {lastUpdated}</div>
        </div>
        <div className="px-6 pt-2 pb-4">
          <Link href="/experiments/metrics/setup" className="text-sm text-primary hover:underline">
            View configuration →
          </Link>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex-shrink-0 px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold">{counts.total}</div>
            <div className="text-sm text-muted-foreground">Total Indicators</div>
          </Card>
          <Card className="p-4 bg-emerald-50 border-emerald-200">
            <div className="text-2xl font-bold text-emerald-600">{counts.onTrack}</div>
            <div className="text-sm text-emerald-700">On Track</div>
          </Card>
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="text-2xl font-bold text-amber-600">{counts.atRisk}</div>
            <div className="text-sm text-amber-700">At Risk</div>
          </Card>
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="text-2xl font-bold text-red-600">{counts.belowTarget}</div>
            <div className="text-sm text-red-700">Below Target</div>
          </Card>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex-shrink-0 px-6 pb-4">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({counts.total})
          </Button>
          <Button
            variant={filter === 'on_track' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('on_track')}
            className={filter === 'on_track' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            On Track ({counts.onTrack})
          </Button>
          <Button
            variant={filter === 'at_risk' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('at_risk')}
            className={filter === 'at_risk' ? 'bg-amber-600 hover:bg-amber-700' : ''}
          >
            At Risk ({counts.atRisk})
          </Button>
          <Button
            variant={filter === 'below_target' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('below_target')}
            className={filter === 'below_target' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            Below Target ({counts.belowTarget})
          </Button>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMetrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      </div>
    </div>
  );
}
