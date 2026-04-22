'use client';

import type { ChartBuilderFormData } from '@/types/charts';

// Import chart type-specific customization components from modules
import { BarChartCustomizations } from './types/bar/BarChartCustomizations';
import { LineChartCustomizations } from './types/line/LineChartCustomizations';
import { PieChartCustomizations } from './types/pie/PieChartCustomizations';
import { NumberChartCustomizations } from './types/number/NumberChartCustomizations';
import { MapChartCustomizations } from './types/map/MapChartCustomizations';
import { TableChartCustomizations } from './types/table/TableChartCustomizations';

interface ChartCustomizationsProps {
  chartType: string;
  formData: ChartBuilderFormData;
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
  chartConfig?: Record<string, any>;
}

type CustomizationUpdates = Record<string, any>;

export function ChartCustomizations({
  chartType,
  formData,
  onChange,
  disabled,
  chartConfig,
}: ChartCustomizationsProps) {
  // Safety check for undefined formData
  if (!formData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Please configure chart data first</p>
      </div>
    );
  }

  const customizations = formData.customizations || {};

  const updateCustomization = (keyOrUpdates: string | CustomizationUpdates, value?: any) => {
    const customizationUpdates =
      typeof keyOrUpdates === 'string' ? { [keyOrUpdates]: value } : keyOrUpdates;

    onChange({
      customizations: {
        ...customizations,
        ...customizationUpdates,
      },
    });
  };

  switch (chartType) {
    case 'bar':
      return (
        <BarChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
          hasExtraDimension={!!formData.extra_dimension_column}
          metrics={formData.metrics}
          chartConfig={chartConfig}
          primaryDimensionLabel={formData.dimension_column || formData.x_axis_column}
          extraDimensionLabel={formData.extra_dimension_column}
        />
      );

    case 'line':
      return (
        <LineChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
          hasExtraDimension={!!formData.extra_dimension_column}
          chartConfig={chartConfig}
        />
      );

    case 'pie':
      return (
        <PieChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
          chartConfig={chartConfig}
        />
      );

    case 'number':
      return (
        <NumberChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
        />
      );

    case 'map':
      return (
        <MapChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
        />
      );

    case 'table':
      return (
        <TableChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
        />
      );

    default:
      return null;
  }
}
