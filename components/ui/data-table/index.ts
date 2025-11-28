// Main DataTable component
export { DataTable, ColumnHeader, ActionsCell, FilterIcon, SortIcon } from './DataTable';

// Sub-components
export { DataTablePagination } from './DataTablePagination';
export { DataTableSelectionBar } from './DataTableSelectionBar';
export { DataTableEmptyState } from './DataTableEmptyState';
export { DataTableSkeleton } from './DataTableSkeleton';
export { DataTableFilterSummary } from './DataTableFilterSummary';

// Filter components
export { TextFilter } from './filters/TextFilter';
export { CheckboxFilter } from './filters/CheckboxFilter';
export { DateFilter } from './filters/DateFilter';

// Types
export type {
  DataTableProps,
  SortState,
  FilterState,
  FilterConfig,
  TextFilterValue,
  CheckboxFilterValue,
  DateFilterValue,
  SelectionConfig,
  PaginationConfig,
  ActionMenuItem,
  EmptyStateConfig,
  SkeletonConfig,
} from './types';

// Re-export TanStack types for convenience
export type { ColumnDef, Row } from '@tanstack/react-table';
