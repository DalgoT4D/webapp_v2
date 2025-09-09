'use client';

import React, { useState } from 'react';
import { useChartExport } from '@/hooks/api/useChart';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Download, FileImage, FileText, Loader2 } from 'lucide-react';
import { ChartExporter, generateFilename } from '@/lib/chart-export';
import { toastSuccess, toastError } from '@/lib/toast';
import * as echarts from 'echarts';

interface ChartExportProps {
  chartId: number;
  chartTitle: string;
  trigger?: React.ReactNode;
  chartInstance?: echarts.ECharts; // echarts.ECharts instance
}

const exportFormats = [
  {
    value: 'png',
    label: 'PNG Image',
    description: 'High-quality raster image, perfect for presentations',
    icon: FileImage,
    extension: '.png',
  },
  {
    value: 'pdf',
    label: 'PDF Document',
    description: 'Professional document format',
    icon: FileText,
    extension: '.pdf',
  },
] as const;

type ExportFormat = (typeof exportFormats)[number]['value'];

export default function ChartExport({
  chartId,
  chartTitle,
  trigger,
  chartInstance,
}: ChartExportProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');
  const [isOpen, setIsOpen] = useState(false);
  const { trigger: exportChart, isMutating } = useChartExport();

  const handleExport = async () => {
    try {
      if (chartInstance) {
        // Use direct ECharts export
        const filename = generateFilename(chartTitle, selectedFormat);
        await ChartExporter.exportEChartsInstance(chartInstance, {
          filename,
          format: selectedFormat,
          backgroundColor: '#ffffff',
        });

        toastSuccess.exported(chartTitle, selectedFormat);
        setIsOpen(false);
        return;
      }

      // Fallback: get chart config from API and create temporary chart
      const response = await exportChart({ chart_id: chartId, format: selectedFormat });

      if (response?.chart_config) {
        // Create temporary element
        const tempDiv = document.createElement('div');
        tempDiv.style.width = '800px';
        tempDiv.style.height = '600px';
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.background = '#ffffff';
        document.body.appendChild(tempDiv);

        try {
          const chart = echarts.init(tempDiv);
          chart.setOption({
            ...response.chart_config,
            animation: false,
          });

          await new Promise((resolve) => setTimeout(resolve, 1000));

          const filename = generateFilename(chartTitle, selectedFormat);
          await ChartExporter.exportEChartsInstance(chart, {
            filename,
            format: selectedFormat,
            backgroundColor: '#ffffff',
          });

          chart.dispose();

          toastSuccess.exported(chartTitle, selectedFormat);
        } finally {
          if (tempDiv.parentNode) {
            document.body.removeChild(tempDiv);
          }
        }
      } else {
        throw new Error('No chart configuration received');
      }

      setIsOpen(false);
    } catch (error: any) {
      console.error('Export failed:', error);
      toastError.export(error, selectedFormat);
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="font-medium uppercase">
      <Download className="w-4 h-4 mr-2" />
      EXPORT
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Chart</DialogTitle>
          <DialogDescription>
            Choose the format you'd like to export "{chartTitle}" in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <RadioGroup
            value={selectedFormat}
            onValueChange={(value) => setSelectedFormat(value as ExportFormat)}
            className="space-y-3"
          >
            {exportFormats.map((format) => {
              const IconComponent = format.icon;
              return (
                <div key={format.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={format.value} id={format.value} />
                  <Label htmlFor={format.value} className="flex-1 cursor-pointer">
                    <Card className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <IconComponent className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{format.label}</div>
                          <div className="text-sm text-gray-600 mt-1">{format.description}</div>
                        </div>
                      </div>
                    </Card>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isMutating}
              className="font-medium uppercase"
            >
              CANCEL
            </Button>
            <Button onClick={handleExport} disabled={isMutating} className="font-medium uppercase">
              {isMutating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  EXPORTING...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  EXPORT {selectedFormat.toUpperCase()}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
