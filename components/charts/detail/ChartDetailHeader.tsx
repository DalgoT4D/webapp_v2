'use client';

import type { ComponentProps } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChartExportDropdown } from '@/components/charts/ChartExportDropdown';
import { RequestEditPill } from '@/components/access/request-edit-pill';
import type { Chart } from '@/types/charts';
import {
  getChartEditUrl,
  getWidgetBackLabel,
  type parseWidgetNavigationSource,
} from '@/lib/widget-navigation';

interface ChartDetailHeaderProps {
  chart: Chart;
  chartId: number;
  navigationSource: ReturnType<typeof parseWidgetNavigationSource>;
  onShare: () => void;
  exportProps: ComponentProps<typeof ChartExportDropdown>;
}

/** Title bar of the chart detail page: back, title, author, edit/share/export, request-edit. */
export function ChartDetailHeader({
  chart,
  chartId,
  navigationSource,
  onShare,
  exportProps,
}: ChartDetailHeaderProps) {
  const router = useRouter();
  return (
    <div className="bg-white border-b px-6 py-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {navigationSource ? (
            <Button
              data-testid="chart-detail-back-dashboard"
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {getWidgetBackLabel(navigationSource)}
            </Button>
          ) : (
            <Link href="/charts" data-testid="chart-detail-back-link">
              <Button data-testid="chart-detail-back-button" variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
          )}
          <h1 className="text-lg font-semibold">{chart.title}</h1>
          {chart.created_by && (
            <span data-testid="chart-detail-created-by" className="text-sm text-muted-foreground">
              · Created by {chart.created_by}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {chart.access_level === 'edit' && (
            <Link
              data-testid="chart-detail-edit-link"
              href={getChartEditUrl(chartId, navigationSource)}
              replace={navigationSource !== null}
            >
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit Chart
              </Button>
            </Link>
          )}
          {chart.access_level === 'edit' && (
            <Button
              data-testid="chart-detail-share-button"
              variant="outline"
              size="sm"
              onClick={onShare}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          )}
          <ChartExportDropdown {...exportProps} />
          <RequestEditPill
            rtype="chart"
            resourceId={chart.id}
            resourceAccessLevel={chart.access_level}
          />
        </div>
      </div>
    </div>
  );
}
