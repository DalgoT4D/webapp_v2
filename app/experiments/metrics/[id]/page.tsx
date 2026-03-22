'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMetric, useMetrics, useProgramme } from '../../_lib/metrics-context';
import { TrendChart } from '../TrendChart';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RagStatus } from '../_lib/types';

const RAG_BADGE_STYLES: Record<RagStatus, string> = {
  on_track: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  at_risk: 'bg-amber-50 text-amber-700 border-amber-200',
  below_target: 'bg-red-50 text-red-700 border-red-200',
};

const RAG_LABELS: Record<RagStatus, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  below_target: 'Below Target',
};

const RAG_BORDER: Record<RagStatus, string> = {
  on_track: 'border-l-emerald-500',
  at_risk: 'border-l-amber-500',
  below_target: 'border-l-red-500',
};

export default function MetricDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const metric = useMetric(id);
  const { updateMetricAnnotation } = useMetrics();

  if (metric === undefined) {
    return null;
  }

  if (metric === null) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 border-b bg-background p-6">
          <Link
            href="/experiments/metrics"
            className="text-sm text-primary hover:underline mb-4 inline-block"
          >
            ← Back to My Metrics
          </Link>
          <h1 className="text-2xl font-bold">Metric not found</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-muted-foreground">The requested metric could not be found.</p>
        </div>
      </div>
    );
  }

  const unit = metric.unit ? ` ${metric.unit}` : '';
  const programme = useProgramme();
  const prevValue =
    metric.trend.length >= 2 ? metric.trend[metric.trend.length - 2] : metric.baseline;
  const trendUp = metric.current >= prevValue;
  const isGoodDirection =
    (metric.direction === 'higher-is-better' && trendUp) ||
    (metric.direction === 'lower-is-better' && !trendUp);

  const handleAnnotationChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateMetricAnnotation(metric.id, e.target.value);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="p-6">
          <Link
            href="/experiments/metrics"
            className="text-sm text-primary hover:underline mb-4 inline-block"
          >
            ← Back to My Metrics
          </Link>
          <h1 className="text-2xl font-bold">{metric.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {metric.category}
            </Badge>
            <Badge
              variant="outline"
              className={cn('font-medium', RAG_BADGE_STYLES[metric.ragStatus])}
            >
              {RAG_LABELS[metric.ragStatus]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Last updated: {programme?.last_updated ?? '23 March 2026'}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Key figures row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={cn('p-4 border-l-4', RAG_BORDER[metric.ragStatus])}>
            <div className="text-sm text-muted-foreground mb-1">Current Value</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {metric.current}
                {unit}
              </span>
              {trendUp ? (
                <ChevronUp
                  className={cn('h-5 w-5', isGoodDirection ? 'text-emerald-600' : 'text-red-600')}
                />
              ) : (
                <ChevronDown
                  className={cn('h-5 w-5', isGoodDirection ? 'text-emerald-600' : 'text-red-600')}
                />
              )}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Target</div>
            <span className="text-2xl font-bold">
              {metric.target}
              {unit}
            </span>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Baseline</div>
            <span className="text-2xl font-bold">
              {metric.baseline}
              {unit}
            </span>
          </Card>
        </div>

        {/* Trend chart */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Trend — 6 Month View</h2>
          <Card className="p-4">
            <TrendChart metric={metric} />
          </Card>
        </div>

        {/* Contextual annotation */}
        <div>
          <h2 className="text-lg font-semibold mb-1">Contextual Annotation</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Why is this metric where it is? Your team&apos;s explanation.
          </p>
          <Card className="p-4">
            <textarea
              value={metric.annotation ?? ''}
              onChange={handleAnnotationChange}
              placeholder="Add context for this period — what happened, what changed, what's being done..."
              className="w-full min-h-[120px] p-3 rounded-md border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
              data-testid="annotation-textarea"
            />
            <p className="text-xs text-muted-foreground mt-2">Saves to this session</p>
          </Card>
        </div>

        {/* Evidence from the field */}
        <div>
          <h2 className="text-lg font-semibold mb-1">Evidence from the Field</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Voices from beneficiaries and field teams
          </p>
          {metric.evidence?.quote ? (
            <Card className="p-6 bg-blue-50/50 border-blue-100">
              <div className="relative">
                <span className="text-4xl text-blue-300 font-serif leading-none">&ldquo;</span>
                <p className="text-base italic pl-8 -mt-6">{metric.evidence.quote}</p>
                <p className="text-sm text-muted-foreground mt-2 pl-8">
                  — {metric.evidence.source}
                </p>
              </div>
            </Card>
          ) : (
            <Card className="p-6 border-2 border-dashed border-muted-foreground/30">
              <p className="text-muted-foreground text-center">
                Select a quote from survey data to attach to this metric
              </p>
            </Card>
          )}
          <Button variant="outline" disabled className="mt-2">
            Browse survey responses →
          </Button>
        </div>

        {/* Report preview hint */}
        <Card className="p-6 bg-muted/30 border-muted">
          <div className="flex items-start gap-4">
            <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0 mt-1" />
            <div>
              <p className="text-sm">
                This metric section — chart, annotation, and evidence — would assemble into the
                operational report for the CCP monthly review.
              </p>
              <Button variant="outline" disabled className="mt-3">
                Preview in Report →
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
