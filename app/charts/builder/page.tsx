'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import ChartBuilder from '@/components/charts/ChartBuilder';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useChartSave } from '@/hooks/api/useChart';
import { useToast } from '@/components/ui/use-toast';

export default function ChartBuilderPage() {
  const router = useRouter();
  const { save } = useChartSave();
  const { toast } = useToast();

  const handleSave = async (chart: any) => {
    try {
      console.log('ChartBuilderPage - Saving chart with payload:', chart);
      const response = await save(chart);
      console.log('ChartBuilderPage - Save response:', response);

      toast({
        title: 'Success',
        description: 'Chart created successfully',
      });

      // Navigate back to charts list
      router.push('/charts');
    } catch (error: any) {
      console.error('ChartBuilderPage - Failed to save chart:', error);

      // Check if it's an authentication error
      if (error.message === 'unauthorized' || error.message.includes('unauthorized')) {
        toast({
          title: 'Authentication Error',
          description: 'Please login again to continue',
          variant: 'destructive',
        });
        // Redirect to login
        router.push('/login');
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to save chart',
          variant: 'destructive',
        });
      }
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
      <ChartBuilder onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
}
