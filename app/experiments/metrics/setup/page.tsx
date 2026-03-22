'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMetrics } from '../../_lib/metrics-context';
import { MetricCard } from '../MetricCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function MetricsSetupPage() {
  const router = useRouter();
  const { yaml, setYaml, parsedData, parseError, applyYaml } = useMetrics();
  const [localYaml, setLocalYaml] = useState(yaml);

  // Sync local edits to context for live preview (parse on change)
  useEffect(() => {
    setYaml(localYaml);
  }, [localYaml, setYaml]);

  const handlePreview = () => {
    applyYaml();
    router.push('/experiments/metrics');
  };

  const metrics = parsedData?.metrics ?? [];
  const programme = parsedData?.programme;
  const onTrackCount = metrics.filter((m) => m.ragStatus === 'on_track').length;
  const atRiskCount = metrics.filter((m) => m.ragStatus === 'at_risk').length;
  const belowTargetCount = metrics.filter((m) => m.ragStatus === 'below_target').length;

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between p-6">
          <div>
            <h1 className="text-3xl font-bold">Metric Configuration</h1>
            <p className="text-muted-foreground mt-1">
              Care Companion Program · Noora Health · Semantic Layer Preview
            </p>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left column - YAML editor */}
        <div className="flex-1 flex flex-col min-w-0" style={{ maxWidth: '60%' }}>
          <div className="flex-1 overflow-hidden p-6 flex flex-col">
            <div
              className="flex-1 rounded-lg border bg-gray-900 text-gray-100 font-mono text-sm overflow-auto"
              style={{ minHeight: 400 }}
            >
              <textarea
                value={localYaml}
                onChange={(e) => setLocalYaml(e.target.value)}
                className="w-full h-full min-h-[400px] p-4 bg-transparent text-gray-100 font-mono text-sm resize-none focus:outline-none"
                spellCheck={false}
                data-testid="yaml-editor"
                style={{ tabSize: 2 }}
              />
            </div>
            {parseError && (
              <p className="text-amber-600 text-sm mt-2">
                Configuration has a syntax issue — showing last valid state
              </p>
            )}
            <div className="mt-4">
              <Button
                onClick={handlePreview}
                variant="ghost"
                className="text-white hover:opacity-90 shadow-xs"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                Preview My Metrics →
              </Button>
            </div>
          </div>
        </div>

        {/* Right column - Live preview */}
        <div
          className="flex-1 flex flex-col border-l bg-muted/20 overflow-hidden"
          style={{ maxWidth: '40%' }}
        >
          <div className="flex-shrink-0 p-4 border-b">
            <h3 className="text-sm font-medium text-muted-foreground">Preview</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {metrics.length > 0 ? (
              <>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{metrics.length} metrics detected</p>
                  <p>
                    {onTrackCount} green · {atRiskCount} amber · {belowTargetCount} red
                  </p>
                </div>
                <div className="space-y-4">
                  {metrics.slice(0, 3).map((metric) => (
                    <MetricCard key={metric.id} metric={metric} />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {parseError
                  ? 'Showing last valid state. Fix the YAML to see a preview.'
                  : 'Edit the YAML to see a live preview.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
