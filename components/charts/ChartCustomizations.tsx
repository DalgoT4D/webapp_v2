'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { ChartTypes, type ChartBuilderFormData } from '@/types/charts';

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
  // Memoize customizations to avoid dependency issues
  const customizations = useMemo(() => formData?.customizations || {}, [formData?.customizations]);

  // Memoize updateCustomization to avoid re-creating on every render
  const updateCustomization = useCallback(
    (key: string, value: unknown) => {
      onChange({
        customizations: {
          ...customizations,
          [key]: value,
        },
      });
    },
    [onChange, customizations]
  );

  // Compute numericColumns for table charts (needed for useEffect cleanup)
  const numericColumns = useMemo(() => {
    if (chartType !== ChartTypes.TABLE || !formData) return [];

    const hasAggregation =
      (formData.dimensions?.length || 0) > 0 || (formData.metrics?.length || 0) > 0;

    // Build a map of column names to their data types
    const columnTypeMap: Record<string, string> = {};
    columns.forEach((col) => {
      const colName = col.column_name || col.name || '';
      if (colName) {
        columnTypeMap[colName] = col.data_type?.toLowerCase() || '';
      }
    });

    if (hasAggregation) {
      const metricCols =
        formData.metrics
          ?.map((m) => m.alias || (m.column ? `${m.aggregation}_${m.column}` : m.aggregation))
          .filter(Boolean) || [];

      const dimensionCols = formData.dimensions?.map((d) => d.column).filter(Boolean) || [];
      const numericDimensionCols = dimensionCols.filter((colName) => {
        const dataType = columnTypeMap[colName];
        return dataType && NUMERIC_DATA_TYPES.includes(dataType);
      });

      return [...numericDimensionCols, ...metricCols];
    } else {
      const displayedCols = formData.table_columns || [];
      return displayedCols.filter((colName) => {
        const dataType = columnTypeMap[colName];
        return dataType && NUMERIC_DATA_TYPES.includes(dataType);
      });
    }
  }, [chartType, formData, columns]);

  // Clean up stale column formatting using useEffect (side effect, not during render)
  useEffect(() => {
    if (chartType !== ChartTypes.TABLE) return;

    const existingFormatting = customizations.columnFormatting || {};
    const numericColumnsSet = new Set(numericColumns);
    const hasStaleFormatting = Object.keys(existingFormatting).some(
      (col) => !numericColumnsSet.has(col)
    );

    if (hasStaleFormatting) {
      const cleanedFormatting = Object.fromEntries(
        Object.entries(existingFormatting).filter(([col]) => numericColumnsSet.has(col))
      );
      updateCustomization('columnFormatting', cleanedFormatting);
    }
  }, [chartType, customizations.columnFormatting, numericColumns, updateCustomization]);

  // Safety check for undefined formData (after hooks)
  if (!formData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Please configure chart data first</p>
      </div>
    );
  }

  switch (chartType) {
    case ChartTypes.BAR:
    case ChartTypes.LINE: {
      // Check if the X-axis (dimension) column is numeric
      const xAxisColumn = formData.dimension_column || '';
      const xAxisDataType = columns
        .find((col) => (col.column_name || col.name) === xAxisColumn)
        ?.data_type?.toLowerCase();
      const hasNumericXAxis = xAxisDataType ? NUMERIC_DATA_TYPES.includes(xAxisDataType) : false;

      if (chartType === ChartTypes.BAR) {
        return (
          <BarChartCustomizations
            customizations={customizations}
            updateCustomization={updateCustomization}
            disabled={disabled}
            hasExtraDimension={!!formData.extra_dimension_column}
            hasNumericXAxis={hasNumericXAxis}
          />
        );
      }
      return (
        <LineChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
          hasNumericXAxis={hasNumericXAxis}
        />
      );
    }

    case ChartTypes.PIE:
      return (
        <PieChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
        />
      );

    case ChartTypes.NUMBER:
      return (
        <NumberChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
        />
      );

    case ChartTypes.MAP:
      return (
        <MapChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
        />
      );

    case ChartTypes.TABLE: {
      // numericColumns is computed in useMemo above
      // Stale formatting cleanup is handled in useEffect above
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
