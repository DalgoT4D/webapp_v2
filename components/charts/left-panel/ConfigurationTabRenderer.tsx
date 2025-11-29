'use client';

import { ChartDataConfigurationV3 } from './ChartDataConfigurationV3';
import { MapDataConfigurationV3 } from '../map/MapDataConfigurationV3';
import type { ChartBuilderFormData } from '@/types/charts';

interface ConfigurationTabRendererProps {
  formData: ChartBuilderFormData;
  onFormChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

/**
 * Strategy component for rendering the appropriate data configuration
 * based on chart type.
 *
 * - 'map' -> MapDataConfigurationV3
 * - All other types -> ChartDataConfigurationV3
 */
export function ConfigurationTabRenderer({
  formData,
  onFormChange,
  disabled,
}: ConfigurationTabRendererProps) {
  if (formData.chart_type === 'map') {
    return (
      <MapDataConfigurationV3
        formData={formData}
        onFormDataChange={onFormChange}
        disabled={disabled}
      />
    );
  }

  return (
    <ChartDataConfigurationV3 formData={formData} onChange={onFormChange} disabled={disabled} />
  );
}
