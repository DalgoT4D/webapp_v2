'use client';

import { useRouter } from 'next/navigation';
import { useChart, useChartData } from '@/hooks/api/useChart';
import { ChartPreview } from '@/components/charts/ChartPreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, Edit } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { ChartDataPayload } from '@/types/charts';

interface ChartDetailClientProps {
  chartId: number;
}

export function ChartDetailClient({ chartId }: ChartDetailClientProps) {
  const router = useRouter();
  const { data: chart, error: chartError, isLoading: chartLoading } = useChart(chartId);

  // Build payload for chart data
  const chartDataPayload: ChartDataPayload | null = chart
    ? {
        chart_type: chart.chart_type,
        computation_type: chart.computation_type,
        schema_name: chart.schema_name,
        table_name: chart.table_name,
        x_axis: chart.extra_config?.x_axis_column,
        y_axis: chart.extra_config?.y_axis_column,
        dimension_col: chart.extra_config?.dimension_column,
        aggregate_col: chart.extra_config?.aggregate_column,
        aggregate_func: chart.extra_config?.aggregate_function,
        extra_dimension: chart.extra_config?.extra_dimension_column,
        customizations: chart.extra_config?.customizations || {},
      }
    : null;

  const {
    data: chartData,
    error: dataError,
    isLoading: dataLoading,
  } = useChartData(chartDataPayload);

  const handleExport = () => {
    // TODO: Implement chart export functionality
    toast.info('Export functionality coming soon');
  };

  if (chartLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (chartError || !chart) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">
          Failed to load chart. Please try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/charts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{chart.title}</h1>
            <p className="text-muted-foreground mt-1">
              {chart.chart_type} chart • {chart.schema_name}.{chart.table_name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/charts/${chartId}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit Chart
            </Button>
          </Link>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Preview - 2/3 width */}
        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle>Chart Preview</CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-5rem)]">
              <ChartPreview
                config={chartData?.echarts_config}
                isLoading={dataLoading}
                error={dataError}
              />
            </CardContent>
          </Card>
        </div>

        {/* Settings - 1/3 width */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-1">Title</h3>
                  <p className="text-sm">{chart.title}</p>
                </div>

                {chart.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">
                      Description
                    </h3>
                    <p className="text-sm">{chart.description}</p>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="capitalize">{chart.chart_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span className="capitalize">{chart.computation_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{new Date(chart.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Updated:</span>
                    <span>{new Date(chart.updated_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Schema:</span>
                    <span>{chart.schema_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Table:</span>
                    <span>{chart.table_name}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
