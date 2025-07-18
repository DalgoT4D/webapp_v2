'use client';

import React, { useState } from 'react';
import { useChartExport } from '@/hooks/api/useChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Download, FileImage, FileText, Image, Loader2 } from 'lucide-react';

interface ChartExportProps {
  chartId: number;
  chartTitle: string;
  trigger?: React.ReactNode;
  echartsRef?: React.RefObject<any>;
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
    value: 'jpeg',
    label: 'JPEG Image',
    description: 'Compressed image format, smaller file size',
    icon: Image,
    extension: '.jpeg',
  },
  {
    value: 'svg',
    label: 'SVG Vector',
    description: 'Scalable vector graphics, ideal for print',
    icon: FileText,
    extension: '.svg',
  },
  {
    value: 'pdf',
    label: 'PDF Document',
    description: 'Professional document format with chart and metadata',
    icon: FileText,
    extension: '.pdf',
  },
] as const;

type ExportFormat = (typeof exportFormats)[number]['value'];

export default function ChartExport({
  chartId,
  chartTitle,
  trigger,
  echartsRef,
}: ChartExportProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');
  const [isOpen, setIsOpen] = useState(false);
  const { trigger: exportChart, isMutating } = useChartExport();

  const handleExport = async () => {
    try {
      if (selectedFormat === 'png' && echartsRef?.current) {
        // Use ECharts instance to export as PNG
        const echartsInstance = echartsRef.current.getEchartsInstance();
        if (echartsInstance) {
          const url = echartsInstance.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: '#fff',
          });

          // Create download link
          const link = document.createElement('a');
          link.href = url;
          link.download = `${chartTitle.replace(/[^a-zA-Z0-9]/g, '_')}.png`;

          // Trigger download
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setIsOpen(false);
          return;
        }
      }

      // Fallback to API export for other formats or if no echarts ref
      const response = await exportChart({ chart_id: chartId, format: selectedFormat });

      // For now, just log the response
      console.log('Export response:', response);

      // TODO: Implement server-side export for other formats
      alert(`Export to ${selectedFormat.toUpperCase()} will be implemented soon!`);

      setIsOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
      // TODO: Show error notification
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Download className="w-4 h-4 mr-2" />
      Export
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
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isMutating}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isMutating}>
              {isMutating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export {selectedFormat.toUpperCase()}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
