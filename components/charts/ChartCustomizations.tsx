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
}

export function ChartCustomizations({
  chartType,
  formData,
  onChange,
  disabled,
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

  const updateCustomization = (key: string, value: any) => {
    onChange({
      customizations: {
        ...customizations,
        [key]: value,
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
        />
      );

    case 'line':
      return (
        <LineChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
        />
      );

    case 'pie':
      return (
        <PieChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
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

    case 'table': {
      // Only show columns that are actually displayed in the table
      // For raw mode: use table_columns (user selected columns)
      // For aggregated mode: use dimensions + metrics (computed columns)

      const hasAggregation =
        (formData.dimensions?.length || 0) > 0 || (formData.metrics?.length || 0) > 0;

      let displayedColumns: string[] = [];

      if (hasAggregation) {
        // Aggregated mode: columns are dimensions + metrics
        const dimensionColumns = formData.dimensions?.map((d) => d.column).filter(Boolean) || [];

        const metricColumns =
          formData.metrics
            ?.map((m) => m.alias || (m.column ? `${m.aggregation}_${m.column}` : m.aggregation))
            .filter(Boolean) || [];

        displayedColumns = [...dimensionColumns, ...metricColumns];
      } else {
        // Raw mode: only show selected table_columns
        displayedColumns = formData.table_columns || [];
      }

      // Clean up formatting for columns that no longer exist in the table
      const existingFormatting = customizations.columnFormatting || {};
      const displayedColumnsSet = new Set(displayedColumns);
      const hasStaleFormatting = Object.keys(existingFormatting).some(
        (col) => !displayedColumnsSet.has(col)
      );

      if (hasStaleFormatting) {
        // Remove formatting for columns that are no longer displayed
        const cleanedFormatting = Object.fromEntries(
          Object.entries(existingFormatting).filter(([col]) => displayedColumnsSet.has(col))
        );
        // Update the customizations to remove stale entries
        updateCustomization('columnFormatting', cleanedFormatting);
      }

      return (
        <TableChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
          availableColumns={displayedColumns}
        />
      );
    }

    default:
      return null;
  }
}
