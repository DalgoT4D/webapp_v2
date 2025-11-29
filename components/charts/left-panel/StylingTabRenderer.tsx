'use client';

import { ChartCustomizations } from '@/components/charts/ChartCustomizations';
import { MapCustomizations } from '@/components/charts/map/MapCustomizations';
import type { ChartBuilderFormData } from '@/types/charts';

interface StylingTabRendererProps {
  formData: ChartBuilderFormData;
  onFormChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

/**
 * Strategy component for rendering the appropriate styling/customization
 * panel based on chart type.
 *
 * - 'map' -> MapCustomizations
 * - 'table' -> null (tables don't have styling options)
 * - All other types -> ChartCustomizations
 */
export function StylingTabRenderer({ formData, onFormChange, disabled }: StylingTabRendererProps) {
  const chartType = formData.chart_type;

  // Tables don't have styling options
  if (chartType === 'table') {
    return null;
  }

  if (chartType === 'map') {
    return <MapCustomizations formData={formData} onFormDataChange={onFormChange} />;
  }

  return (
    <ChartCustomizations
      chartType={chartType || 'bar'}
      formData={formData}
      onChange={onFormChange}
      disabled={disabled}
    />
  );
}

/**
 * Helper to determine if styling tab should be shown for a chart type
 */
export function hasStylingTab(chartType: string | undefined): boolean {
  return chartType !== 'table';
}
