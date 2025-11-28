import { ReactNode } from 'react';
import { ColumnDef, Row, Table, PaginationState } from '@tanstack/react-table';

// Re-export TanStack's types for convenience
export type { ColumnDef, Row, Table, PaginationState };

// Sort state
export interface SortState {
  column: string | null;
  direction: 'asc' | 'desc';
}

// Generic filter state - keys are column IDs, values depend on filter type
export interface FilterState {
  [columnId: string]: unknown;
}

// Text filter value
export interface TextFilterValue {
  text: string;
  showFavorites?: boolean;
  showLocked?: boolean;
  showShared?: boolean;
}

// Checkbox filter value (array of selected values)
export type CheckboxFilterValue = string[];

// Date filter value
export interface DateFilterValue {
  range: 'all' | 'today' | 'week' | 'month' | 'custom';
  customStart: Date | null;
  customEnd: Date | null;
}

// Filter configuration for a column
export interface FilterConfig {
  type: 'text' | 'checkbox' | 'date' | 'custom';
  placeholder?: string;
  // For text filters with extra checkboxes
  checkboxOptions?: Array<{
    key: string;
    label: string;
  }>;
  // For checkbox filters - will be computed from data if not provided
  options?: Array<{
    value: string;
    label: string;
  }>;
  // For custom filter rendering
  render?: (props: {
    value: unknown;
    onChange: (value: unknown) => void;
    onClear: () => void;
  }) => ReactNode;
}

// Selection configuration
export interface SelectionConfig<TData> {
  enabled: boolean;
  selectedIds: Set<string | number>;
  onSelectionChange: (ids: Set<string | number>) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExitSelection: () => void;
  totalCount: number;
  bulkAction?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    visible?: boolean;
  };
  getRowId: (row: TData) => string | number;
}

// Pagination configuration - simplified, TanStack handles the logic
export interface PaginationConfig {
  // Page size options for the dropdown
  pageSizeOptions?: number[];
  // Initial page size (defaults to 10)
  initialPageSize?: number;
  // Total row count (for display purposes)
  totalRows: number;
}

// Action menu item configuration
export interface ActionMenuItem<TData> {
  id: string;
  label: string | ((row: TData) => string);
  icon?: ReactNode | ((row: TData) => ReactNode);
  onClick?: (row: TData) => void;
  disabled?: boolean | ((row: TData) => boolean);
  hidden?: boolean | ((row: TData) => boolean);
  variant?: 'default' | 'destructive';
  separator?: 'before' | 'after';
  // For wrapping with dialogs (AlertDialog, etc.)
  render?: (row: TData, menuItem: ReactNode) => ReactNode;
  // For section headers
  isHeader?: boolean;
}

// Empty state configuration
export interface EmptyStateConfig {
  icon?: ReactNode;
  title: string;
  filteredTitle?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: ReactNode;
    visible?: boolean;
  };
}

// Loading skeleton configuration
export interface SkeletonConfig {
  rowCount?: number;
  columns: Array<{
    width: string;
    cellType?: 'text' | 'icon' | 'avatar' | 'badge' | 'actions';
  }>;
}

// Main DataTable props
export interface DataTableProps<TData> {
  // Data
  data: TData[];
  columns: ColumnDef<TData, unknown>[];

  // State
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;

  // Row identification
  getRowId: (row: TData) => string | number;

  // Pinned rows (for dashboards) - rendered first, not affected by pagination
  pinnedRows?: TData[];

  // Sorting
  sortState?: SortState;
  onSortChange?: (sort: SortState) => void;

  // Filtering
  filterState?: FilterState;
  onFilterChange?: (filters: FilterState) => void;
  filterConfigs?: Record<string, FilterConfig>;
  activeFilterCount?: number;
  onClearAllFilters?: () => void;

  // Selection
  selection?: SelectionConfig<TData>;

  // Pagination - TanStack handles state internally
  pagination?: PaginationConfig;

  // Empty state
  emptyState?: EmptyStateConfig;

  // Loading skeleton
  skeleton?: SkeletonConfig;

  // Styling
  className?: string;
  tableClassName?: string;

  // ID prefix for accessibility
  idPrefix?: string;
}
