'use client';

import type { ChartBuilderFormData } from '@/types/charts';

// Import chart type-specific customization components from modules
import { BarChartCustomizations } from './types/bar/BarChartCustomizations';
import { LineChartCustomizations } from './types/line/LineChartCustomizations';
import { PieChartCustomizations } from './types/pie/PieChartCustomizations';
import { NumberChartCustomizations } from './types/number/NumberChartCustomizations';
import { MapChartCustomizations } from './types/map/MapChartCustomizations';
import { TableChartCustomizations } from './types/table/TableChartCustomizations';

// Numeric data types that can have number formatting applied
const NUMERIC_DATA_TYPES = [
  'integer',
  'smallint',
  'bigint',
  'numeric',
  'double precision',
  'real',
  'float',
  'decimal',
];

interface ColumnInfo {
  column_name?: string;
  name?: string;
  data_type: string;
}

interface ChartCustomizationsProps {
  chartType: string;
  formData: ChartBuilderFormData;
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
  columns?: ColumnInfo[]; // Column metadata for filtering by type
}

export function ChartCustomizations({
  chartType,
  formData,
  onChange,
  disabled,
  columns = [],
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

      // Build a map of column names to their data types
      const columnTypeMap: Record<string, string> = {};
      columns.forEach((col) => {
        const colName = col.column_name || col.name || '';
        if (colName) {
          columnTypeMap[colName] = col.data_type?.toLowerCase() || '';
        }
      });

      // Filter to only show numeric columns for number formatting
      // In aggregated mode, metric columns are always numeric (aggregation results)
      // Dimension columns are also included if they have a numeric data type
      // In raw mode, filter by actual column data type
      let numericColumns: string[] = [];

      if (hasAggregation) {
        // Metric columns are always numeric (aggregation results)
        const metricColumns =
          formData.metrics
            ?.map((m) => m.alias || (m.column ? `${m.aggregation}_${m.column}` : m.aggregation))
            .filter(Boolean) || [];

        // Dimension columns that have numeric data types should also be included
        const dimensionColumns = formData.dimensions?.map((d) => d.column).filter(Boolean) || [];
        const numericDimensionColumns = dimensionColumns.filter((colName) => {
          const dataType = columnTypeMap[colName];
          return dataType && NUMERIC_DATA_TYPES.includes(dataType);
        });

        numericColumns = [...numericDimensionColumns, ...metricColumns];
      } else {
        // In raw mode: filter by actual column data type
        numericColumns = displayedColumns.filter((colName) => {
          const dataType = columnTypeMap[colName];
          return dataType && NUMERIC_DATA_TYPES.includes(dataType);
        });
      }

      // Clean up formatting for columns that no longer exist or are no longer numeric
      const existingFormatting = customizations.columnFormatting || {};
      const numericColumnsSet = new Set(numericColumns);
      const hasStaleFormatting = Object.keys(existingFormatting).some(
        (col) => !numericColumnsSet.has(col)
      );

      if (hasStaleFormatting) {
        // Remove formatting for columns that are no longer displayed or not numeric
        const cleanedFormatting = Object.fromEntries(
          Object.entries(existingFormatting).filter(([col]) => numericColumnsSet.has(col))
        );
        // Update the customizations to remove stale entries
        updateCustomization('columnFormatting', cleanedFormatting);
      }

      return (
        <TableChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
          availableColumns={numericColumns}
        />
      );
    }

    default:
      return null;
  }
}
