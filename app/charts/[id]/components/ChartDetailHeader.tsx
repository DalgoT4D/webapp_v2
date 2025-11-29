'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChartExportDropdown } from '@/components/charts/export';
import { ArrowLeft, Edit } from 'lucide-react';
import type { ChartDataPayload } from '@/types/charts';
import type * as echarts from 'echarts';

interface ChartDetailHeaderProps {
  chartId: number;
  chartTitle: string;
  chartType: string;
  hasEditPermission: boolean;
  chartElement: HTMLElement | null;
  chartInstance: echarts.ECharts | null;
  chartDataPayload: ChartDataPayload | null;
  tableElement?: HTMLElement | null;
}

export function ChartDetailHeader({
  chartId,
  chartTitle,
  chartType,
  hasEditPermission,
  chartElement,
  chartInstance,
  chartDataPayload,
  tableElement,
}: ChartDetailHeaderProps) {
  return (
    <div className="bg-white border-b px-6 py-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/charts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">{chartTitle}</h1>
        </div>
        <div className="flex gap-2">
          {hasEditPermission && (
            <Link href={`/charts/${chartId}/edit`}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit Chart
              </Button>
            </Link>
          )}
          <ChartExportDropdown
            chartTitle={chartTitle}
            chartElement={chartElement}
            chartInstance={chartInstance}
            chartType={chartType}
            chartDataPayload={chartDataPayload}
            tableElement={tableElement}
          />
        </div>
      </div>
    </div>
  );
}
