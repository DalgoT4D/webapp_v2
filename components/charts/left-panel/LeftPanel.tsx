'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, BarChart3 } from 'lucide-react';
import { ConfigurationTabRenderer } from './ConfigurationTabRenderer';
import { StylingTabRenderer, hasStylingTab } from './StylingTabRenderer';
import type { ChartBuilderFormData } from '@/types/charts';

export interface LeftPanelProps {
  formData: ChartBuilderFormData;
  onFormChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

/**
 * Left panel component for chart builder.
 * Displays Data Configuration and Chart Styling tabs.
 *
 * Uses strategy pattern to render appropriate content based on chart type:
 * - ConfigurationTabRenderer handles data configuration
 * - StylingTabRenderer handles chart customizations
 */
export function LeftPanel({ formData, onFormChange, disabled }: LeftPanelProps) {
  const showStylingTab = hasStylingTab(formData.chart_type);

  return (
    <div className="w-[30%] border-r">
      <Tabs defaultValue="configuration" className="h-full">
        <div className="px-4 pt-4">
          <TabsList
            className={`grid w-full h-11 ${showStylingTab ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            <TabsTrigger
              value="configuration"
              className="flex items-center justify-center gap-2 text-sm h-full"
            >
              <BarChart3 className="h-4 w-4" />
              Data Configuration
            </TabsTrigger>
            {showStylingTab && (
              <TabsTrigger
                value="styling"
                className="flex items-center justify-center gap-2 text-sm h-full"
              >
                <Database className="h-4 w-4" />
                Chart Styling
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="configuration" className="mt-6 h-[calc(100%-73px)] overflow-y-auto">
          <div className="p-4">
            <ConfigurationTabRenderer
              formData={formData}
              onFormChange={onFormChange}
              disabled={disabled}
            />
          </div>
        </TabsContent>

        {showStylingTab && (
          <TabsContent value="styling" className="h-[calc(100%-73px)] overflow-y-auto">
            <div className="p-4">
              <StylingTabRenderer
                formData={formData}
                onFormChange={onFormChange}
                disabled={disabled}
              />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
