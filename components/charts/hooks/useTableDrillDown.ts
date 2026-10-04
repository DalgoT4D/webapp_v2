'use client';

import { useCallback, useState } from 'react';
import type { ChartDimension } from '@/types/charts';
import type { TableDrillDownState } from '@/components/charts/logic/payload';
import {
  drillIntoTableRow,
  drillUpTable,
  getAllDimensionColumns,
  getCurrentDrillColumn,
  getDrillDownColumns,
  isTableDrillDownEnabled,
} from '@/components/charts/logic/table-drilldown';

interface UseTableDrillDownOptions {
  dimensions: ChartDimension[] | undefined;
  /** Clicks are ignored unless the chart is a table. */
  isTable: boolean;
  /** BUILDER-DRIFT: the create page rebuilds drill-up filters from every dimension; edit/detail from drill columns. */
  drillUpColumns: 'all' | 'drillEnabled';
  /** Runs after every level change (callers reset the table to page 1). */
  onLevelChange: () => void;
}

export function useTableDrillDown({
  dimensions,
  isTable,
  drillUpColumns,
  onLevelChange,
}: UseTableDrillDownOptions) {
  const [tableDrillDownState, setTableDrillDownState] = useState<TableDrillDownState | null>(null);

  const handleTableRowClick = useCallback(
    (rowData: Record<string, any>, columnName: string) => {
      if (!isTable) return;
      const next = drillIntoTableRow(dimensions, tableDrillDownState, rowData, columnName);
      if (!next) return;
      setTableDrillDownState(next);
      onLevelChange();
    },
    [isTable, dimensions, tableDrillDownState, onLevelChange]
  );

  const handleTableDrillUp = useCallback(() => {
    if (!tableDrillDownState) return;
    const columns =
      drillUpColumns === 'all'
        ? getAllDimensionColumns(dimensions)
        : getDrillDownColumns(dimensions);
    setTableDrillDownState(drillUpTable(tableDrillDownState, columns));
    onLevelChange();
  }, [tableDrillDownState, dimensions, drillUpColumns, onLevelChange]);

  return {
    tableDrillDownState,
    handleTableRowClick,
    handleTableDrillUp,
    isDrillDownEnabled: isTableDrillDownEnabled(dimensions),
    currentDimensionColumn: getCurrentDrillColumn(dimensions, tableDrillDownState),
    /** 0-based index of the shown dimension (0 = top level). */
    currentDrillLevel: tableDrillDownState ? tableDrillDownState.currentLevel + 1 : 0,
  };
}
