'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChartBuilder } from '@/components/charts/ChartBuilder';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useCreateChart } from '@/hooks/api/useChart';
import type { ChartCreate } from '@/types/charts';
import { toastError, toastSuccess } from '@/lib/toast';

export default function ChartBuilderPage() {
  const router = useRouter();
  const { trigger: createChart, isMutating } = useCreateChart();

  const handleSave = async (chart: ChartCreate) => {
    try {
      const response = await createChart(chart);

      toastSuccess.saved('Chart created successfully');

      // Navigate back to charts list
      router.push('/charts');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save chart';

      toastError.save(errorMessage);
    }
  };

  const handleCancel = () => {
    router.push('/charts');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Charts</span>
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-xl font-semibold">Create New Chart</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Builder */}
      <ChartBuilder onSave={handleSave} onCancel={handleCancel} isSaving={isMutating} />
    </div>
  );
}
