'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { ChartTypes, type ChartBuilderFormData } from '@/types/charts';
import {
  NumericDataType,
  type NumericDataTypeValue,
  DateDataType,
  type DateDataTypeValue,
} from '@/constants/data-types';

// Import chart type-specific customization components from modules
import { BarChartCustomizations } from './types/bar/BarChartCustomizations';
import { LineChartCustomizations } from './types/line/LineChartCustomizations';
import { PieChartCustomizations } from './types/pie/PieChartCustomizations';
import { NumberChartCustomizations } from './types/number/NumberChartCustomizations';
import { MapChartCustomizations } from './types/map/MapChartCustomizations';
import { TableChartCustomizations } from './types/table/TableChartCustomizations';
import PivotTableCustomizations from '@/components/charts/pivot-table/PivotTableCustomizations';

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

  // Build a map of raw column names to their data types (used by both memos below)
  const rawColumnTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    columns.forEach((col) => {
      const colName = col.column_name || col.name || '';
      if (colName) {
        map[colName] = col.data_type?.toLowerCase() || '';
      }
    });
    return map;
  }, [columns]);

  // Compute numericColumns for table charts (needed for useEffect cleanup)
  const numericColumns = useMemo(() => {
    if (chartType !== ChartTypes.TABLE || !formData) return [];

    const hasAggregation =
      (formData.dimensions?.length || 0) > 0 || (formData.metrics?.length || 0) > 0;

    if (hasAggregation) {
      const metricCols =
        formData.metrics
          ?.map((m) => m.alias || (m.column ? `${m.aggregation}_${m.column}` : m.aggregation))
          .filter(Boolean) || [];

      const dimensionCols = formData.dimensions?.map((d) => d.column).filter(Boolean) || [];
      const numericDimensionCols = dimensionCols.filter((colName) => {
        const dataType = rawColumnTypeMap[colName];
        return (
          dataType && Object.values(NumericDataType).includes(dataType as NumericDataTypeValue)
        );
      });

      return [...numericDimensionCols, ...metricCols];
    } else {
      const displayedCols = formData.table_columns || [];
      return displayedCols.filter((colName) => {
        const dataType = rawColumnTypeMap[colName];
        return (
          dataType && Object.values(NumericDataType).includes(dataType as NumericDataTypeValue)
        );
      });
    }
  }, [chartType, formData, rawColumnTypeMap]);

  // Compute columnTypeMap for conditional formatting — maps each displayed column to 'numeric' | 'text'
  const columnTypeMap = useMemo((): Record<string, 'numeric' | 'text'> => {
    if (chartType !== ChartTypes.TABLE || !formData) return {};

    const hasAggregation =
      (formData.dimensions?.length || 0) > 0 || (formData.metrics?.length || 0) > 0;

    const result: Record<string, 'numeric' | 'text'> = {};

    if (hasAggregation) {
      // Dimension columns: check raw data type
      (formData.dimensions || []).forEach((d) => {
        const colName = d.column;
        if (!colName) return;
        const dataType = rawColumnTypeMap[colName];
        result[colName] =
          dataType && Object.values(NumericDataType).includes(dataType as NumericDataTypeValue)
            ? 'numeric'
            : 'text';
      });
      // Metric alias columns: always numeric (they are aggregations)
      (formData.metrics || []).forEach((m) => {
        const alias = m.alias || (m.column ? `${m.aggregation}_${m.column}` : m.aggregation);
        if (alias) result[alias] = 'numeric';
      });
    } else {
      (formData.table_columns || []).forEach((colName) => {
        const dataType = rawColumnTypeMap[colName];
        result[colName] =
          dataType && Object.values(NumericDataType).includes(dataType as NumericDataTypeValue)
            ? 'numeric'
            : 'text';
      });
    }

    return result;
  }, [chartType, formData, rawColumnTypeMap]);

  // Compute drill-down context for conditional formatting UI
  const drillDownEnabled =
    chartType === ChartTypes.TABLE &&
    (formData?.dimensions?.some((d) => d.enable_drill_down) ?? false);

  const orderedDimensions = useMemo(() => {
    if (!drillDownEnabled || !formData?.dimensions) return [];
    return formData.dimensions
      .filter((d) => d.enable_drill_down)
      .map((d) => d.column)
      .filter(Boolean) as string[];
  }, [drillDownEnabled, formData?.dimensions]);

  // Compute dateColumns for table charts (needed for useEffect cleanup)
  const dateColumns = useMemo(() => {
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
      // Only dimension columns can be date types (metrics are always numeric)
      const dimensionCols = formData.dimensions?.map((d) => d.column).filter(Boolean) || [];
      return dimensionCols.filter((colName) => {
        const dataType = columnTypeMap[colName];
        return dataType && Object.values(DateDataType).includes(dataType as DateDataTypeValue);
      });
    } else {
      const displayedCols = formData.table_columns || [];
      return displayedCols.filter((colName) => {
        const dataType = columnTypeMap[colName];
        return dataType && Object.values(DateDataType).includes(dataType as DateDataTypeValue);
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

  // Clean up stale date column formatting using useEffect
  useEffect(() => {
    if (chartType !== ChartTypes.TABLE) return;

    const existingDateFormatting = customizations.dateColumnFormatting || {};
    const dateColumnsSet = new Set(dateColumns);
    const hasStaleDateFormatting = Object.keys(existingDateFormatting).some(
      (col) => !dateColumnsSet.has(col)
    );

    if (hasStaleDateFormatting) {
      const cleanedDateFormatting = Object.fromEntries(
        Object.entries(existingDateFormatting).filter(([col]) => dateColumnsSet.has(col))
      );
      updateCustomization('dateColumnFormatting', cleanedDateFormatting);
    }
  }, [chartType, customizations.dateColumnFormatting, dateColumns, updateCustomization]);

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
      const hasNumericXAxis = xAxisDataType
        ? Object.values(NumericDataType).includes(xAxisDataType as NumericDataTypeValue)
        : false;
      const hasDateXAxis = xAxisDataType
        ? Object.values(DateDataType).includes(xAxisDataType as DateDataTypeValue)
        : false;

      if (chartType === ChartTypes.BAR) {
        return (
          <BarChartCustomizations
            customizations={customizations}
            updateCustomization={updateCustomization}
            disabled={disabled}
            hasExtraDimension={!!formData.extra_dimension_column}
            hasNumericXAxis={hasNumericXAxis}
            hasDateXAxis={hasDateXAxis}
          />
        );
      }
      return (
        <LineChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
          hasNumericXAxis={hasNumericXAxis}
          hasDateXAxis={hasDateXAxis}
        />
      );
    }

    case ChartTypes.PIE: {
      const dimensionColumn = formData.dimension_column || '';
      const extraDimensionColumn = formData.extra_dimension_column || '';

      const isDateColumn = (colName: string) => {
        if (!colName) return false;
        const dataType = columns
          .find((col) => (col.column_name || col.name) === colName)
          ?.data_type?.toLowerCase();
        return dataType
          ? Object.values(DateDataType).includes(dataType as DateDataTypeValue)
          : false;
      };

      const dimensionIsDate = isDateColumn(dimensionColumn);
      const extraDimensionIsDate = isDateColumn(extraDimensionColumn);
      const hasDimensionDate = dimensionIsDate || extraDimensionIsDate;

      // Show both column names if both are dates, otherwise show whichever one is a date
      const dateColumnLabel =
        dimensionIsDate && extraDimensionIsDate
          ? `${dimensionColumn}, ${extraDimensionColumn}`
          : dimensionIsDate
            ? dimensionColumn
            : extraDimensionColumn;

      return (
        <PieChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
          hasDimensionDate={hasDimensionDate}
          dimensionColumn={dateColumnLabel}
        />
      );
    }

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

      // Get all displayed column names including metric aliases
      const hasTableAggregation =
        (formData.dimensions?.length || 0) > 0 || (formData.metrics?.length || 0) > 0;

      // Default column order from dimensions+metrics or table_columns
      const defaultColumns = hasTableAggregation
        ? [
            ...(formData.dimensions?.map((d) => d.column).filter(Boolean) || []),
            ...(formData.metrics
              ?.map((m) => m.alias || (m.column ? `${m.aggregation}_${m.column}` : m.aggregation))
              .filter(Boolean) || []),
          ]
        : formData.table_columns || [];

      // Use saved column order if it matches the current columns exactly
      const savedOrder: string[] | undefined = customizations.columnOrder;
      const allDisplayedColumns =
        savedOrder &&
        savedOrder.length === defaultColumns.length &&
        savedOrder.every((col: string) => defaultColumns.includes(col))
          ? savedOrder
          : defaultColumns;

      return (
        <TableChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
          availableColumns={numericColumns}
          allColumns={allDisplayedColumns}
          columnTypeMap={columnTypeMap}
          drillDownEnabled={drillDownEnabled}
          orderedDimensions={orderedDimensions}
          onTableColumnsChange={(newOrder: string[]) => {
            updateCustomization('columnOrder', newOrder);
          }}
          availableDateColumns={dateColumns}
        />
      );
    }

    case ChartTypes.PIVOT_TABLE: {
      // Derive metric column names from formData.metrics
      const pivotMetricColumns =
        formData.metrics
          ?.map((m) => m.alias || (m.column ? `${m.aggregation}_${m.column}` : m.aggregation))
          .filter(Boolean) || [];

      return (
        <PivotTableCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
          metricColumns={pivotMetricColumns}
        />
      );
    }

    default:
      return null;
  }
}
