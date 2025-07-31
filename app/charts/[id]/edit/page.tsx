'use client';

import { useParams, useRouter } from 'next/navigation';
import { useChart, useUpdateChart } from '@/hooks/api/useChart';
import { ChartBuilder } from '@/components/charts/ChartBuilder';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { ChartCreate, ChartUpdate } from '@/types/charts';

export default function EditChartPage() {
  const params = useParams();
  const router = useRouter();
  const chartId = Number(params.id);

  const { data: chart, error: chartError, isLoading: chartLoading } = useChart(chartId);
  const { trigger: updateChart, isMutating } = useUpdateChart();

  const handleSave = async (chartData: ChartCreate) => {
    try {
      // Convert ChartCreate to ChartUpdate format
      const updateData: ChartUpdate = {
        title: chartData.title,
        description: chartData.description,
        chart_type: chartData.chart_type,
        computation_type: chartData.computation_type,
        schema_name: chartData.schema_name,
        table_name: chartData.table_name,
        extra_config: chartData.extra_config,
      };

      await updateChart({
        id: chartId,
        data: updateData,
      });

      toast.success('Chart updated successfully');
      router.push(`/charts/${chartId}`);
    } catch (error) {
      toast.error('Failed to update chart');
    }
  };

  const handleCancel = () => {
    router.push(`/charts/${chartId}`);
  };

  if (chartLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </div>
    );
  }

  if (chartError || !chart) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="max-w-2xl mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {chartError ? 'Failed to load chart' : 'Chart not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Convert Chart to ChartCreate format for ChartBuilder
  const initialData: Partial<ChartCreate> = {
    title: chart.title,
    description: chart.description,
    chart_type: chart.chart_type as 'bar' | 'pie' | 'line',
    computation_type: chart.computation_type as 'raw' | 'aggregated',
    schema_name: chart.schema_name,
    table_name: chart.table_name,
    // Flatten extra_config for ChartBuilder's internal state
    x_axis_column: chart.extra_config?.x_axis_column,
    y_axis_column: chart.extra_config?.y_axis_column,
    dimension_column: chart.extra_config?.dimension_column,
    aggregate_column: chart.extra_config?.aggregate_column,
    aggregate_function: chart.extra_config?.aggregate_function,
    extra_dimension_column: chart.extra_config?.extra_dimension_column,
    customizations: chart.extra_config?.customizations || {},
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Edit Chart</h1>
        <ChartBuilder
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={isMutating}
          initialData={initialData}
        />
      </div>
    </div>
  );
}
