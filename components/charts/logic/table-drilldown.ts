import type { ChartDimension } from '@/types/charts';
import type { TableDrillDownState } from '@/components/charts/logic/payload';

type Dimensions = ChartDimension[] | undefined;

export function isTableDrillDownEnabled(dimensions: Dimensions): boolean {
  return !!dimensions?.some((dim) => dim.enable_drill_down === true);
}

/** Columns of the drill-enabled dimensions, in order. */
export function getDrillDownColumns(dimensions: Dimensions): string[] {
  return (
    dimensions
      ?.filter((dim) => dim.enable_drill_down)
      .map((d) => d.column)
      .filter(Boolean) || []
  );
}

/** Every dimension column (the create page's drill-up uses these). */
export function getAllDimensionColumns(dimensions: Dimensions): string[] {
  return dimensions?.map((d) => d.column).filter(Boolean) || [];
}

/** The dimension column the table is currently grouped by. */
export function getCurrentDrillColumn(
  dimensions: Dimensions,
  state: TableDrillDownState | null
): string | undefined {
  const columns = getDrillDownColumns(dimensions);
  return state ? columns[state.currentLevel + 1] : columns[0];
}

/**
 * Next state after clicking a cell, or null when the click does nothing (wrong column, empty value,
 * or the last level — PINNED-BUGS: "Table last drill level renders clickable but click does nothing").
 */
export function drillIntoTableRow(
  dimensions: Dimensions,
  state: TableDrillDownState | null,
  row: Record<string, unknown>,
  columnName: string
): TableDrillDownState | null {
  if (!isTableDrillDownEnabled(dimensions)) return null;
  const columns = getDrillDownColumns(dimensions);
  if (columns.length === 0) return null;

  const currentIndex = state ? state.currentLevel : -1;
  const displayedColumn = currentIndex === -1 ? columns[0] : columns[currentIndex + 1];
  if (columnName !== displayedColumn) return null;

  const clickedValue = row[columnName];
  if (!clickedValue) return null;

  const newLevel = currentIndex + 1;
  if (newLevel >= columns.length - 1) return null;

  return {
    currentLevel: newLevel,
    appliedFilters: { ...(state?.appliedFilters || {}), [displayedColumn]: String(clickedValue) },
  };
}

/** One level up; null = back at the top. `columns` decides which filters are kept. */
export function drillUpTable(
  state: TableDrillDownState,
  columns: string[]
): TableDrillDownState | null {
  const newLevel = state.currentLevel - 1;
  if (newLevel < 0) return null;

  const appliedFilters: Record<string, string> = {};
  for (let i = 0; i <= newLevel; i++) {
    const column = columns[i];
    if (state.appliedFilters[column]) appliedFilters[column] = state.appliedFilters[column];
  }
  return { currentLevel: newLevel, appliedFilters };
}
