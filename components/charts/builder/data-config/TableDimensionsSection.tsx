'use client';

import { TableDimensionsSelector } from '@/components/charts/TableDimensionsSelector';
import type { ChartConfigPatch } from '@/components/charts/logic/type-switch';
import type { ChartBuilderFormData } from '@/types/charts';
import type { NormalizedColumn } from './column-types';

interface TableDimensionsSectionProps {
  formData: ChartBuilderFormData;
  onChange: (patch: ChartConfigPatch) => void;
  disabled?: boolean;
  normalizedColumns: NormalizedColumn[];
  /** True when any conditional formatting rule has a level scope — for T7 reorder warning */
  hasLevelScopedRules?: boolean;
  /** Called after dimension reorder when level-scoped rules exist — for T7 */
  onReorderWithScopedRules?: () => void;
  /** Maps dimension column name → count of rules scoped to it — for T9 remove warning */
  scopedRuleCountByLevel?: Record<string, number>;
}

/** Table chart dimensions (multiple, with drill-down support). */
export function TableDimensionsSection({
  formData,
  onChange,
  disabled,
  normalizedColumns,
  hasLevelScopedRules,
  onReorderWithScopedRules,
  scopedRuleCountByLevel,
}: TableDimensionsSectionProps) {
  return (
    <TableDimensionsSelector
      dimensions={
        formData.dimensions && formData.dimensions.length > 0
          ? formData.dimensions
          : formData.dimension_column
            ? [{ column: formData.dimension_column, enable_drill_down: false }]
            : []
      }
      availableColumns={normalizedColumns}
      onChange={(dimensions) => {
        // Convert dimensions array to formData format
        const dimensionColumns = dimensions.map((d) => d.column).filter(Boolean);
        onChange({
          dimensions,
          dimension_columns: dimensionColumns,
          // Keep dimension_column for backward compatibility (use first dimension)
          dimension_column: dimensionColumns[0] || undefined,
          // Clear extra_dimension_column when using dimensions array
          extra_dimension_column: undefined,
        });
      }}
      disabled={disabled}
      hasLevelScopedRules={hasLevelScopedRules}
      onReorderWithScopedRules={onReorderWithScopedRules}
      scopedRuleCountByLevel={scopedRuleCountByLevel}
    />
  );
}
