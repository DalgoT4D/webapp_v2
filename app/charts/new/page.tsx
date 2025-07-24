'use client';

import { useRouter } from 'next/navigation';
import { ChartBuilder } from '@/components/charts/ChartBuilder';
import { useCreateChart } from '@/hooks/api/useChart';
import { toast } from 'sonner';
import type { ChartCreate } from '@/types/charts';

export default function NewChartPage() {
  const router = useRouter();
  const { trigger: createChart, isMutating } = useCreateChart();

  const handleSave = async (chartData: ChartCreate) => {
    try {
      const result = await createChart(chartData);
      toast.success('Chart created successfully');
      router.push(`/charts/${result.id}`);
    } catch (error) {
      toast.error('Failed to create chart');
    }
  };

  const handleCancel = () => {
    router.push('/charts');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create New Chart</h1>
        <p className="text-muted-foreground mt-1">
          Build interactive visualizations from your data
        </p>
      </div>

      <ChartBuilder onSave={handleSave} onCancel={handleCancel} isSaving={isMutating} />
    </div>
  );
}
