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
    } catch {
      toast.error('Failed to create chart');
    }
  };

  const handleCancel = () => {
    router.push('/charts');
  };

  return (
    <div className="container mx-auto px-8 py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Chart</h1>
        <p className="text-muted-foreground mt-2">
          Build interactive visualizations from your data
        </p>
      </div>

      <ChartBuilder onSave={handleSave} onCancel={handleCancel} isSaving={isMutating} />
    </div>
  );
}
