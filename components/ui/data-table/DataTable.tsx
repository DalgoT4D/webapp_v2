'use client';

import { useState, ReactNode } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type PaginationState,
} from '@tanstack/react-table';

// Extend TanStack Table's ColumnMeta to include our custom properties
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    headerClassName?: string;
    cellClassName?: string;
  }
}

import {
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Filter,
  MoreVertical,
  MoreHorizontal,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  DataTableProps,
  ActionMenuItem,
  SortState,
  FilterState,
  FilterConfig,
  TextFilterValue,
  DateFilterValue,
} from './types';
import { TextFilter } from './filters/TextFilter';
import { CheckboxFilter } from './filters/CheckboxFilter';
import { DateFilter } from './filters/DateFilter';
import { DataTablePagination } from './DataTablePagination';
import { DataTableSelectionBar } from './DataTableSelectionBar';
import { DataTableEmptyState } from './DataTableEmptyState';
import { DataTableSkeleton } from './DataTableSkeleton';
import { DataTableFilterSummary } from './DataTableFilterSummary';

// Helper to check if a column has an active filter
function hasActiveFilter(
  columnId: string,
  filterState: FilterState | undefined,
  filterConfig: FilterConfig | undefined
): boolean {
  if (!filterState || !filterConfig) return false;
  const value = filterState[columnId];
  if (value === undefined || value === null) return false;

  switch (filterConfig.type) {
    case 'text': {
      const textValue = value as TextFilterValue;
      return !!(
        textValue.text ||
        textValue.showFavorites ||
        textValue.showLocked ||
        textValue.showShared
      );
    }
    case 'checkbox':
      return Array.isArray(value) && value.length > 0;
    case 'date': {
      const dateValue = value as DateFilterValue;
      return dateValue.range !== 'all';
    }
    default:
      return !!value;
  }
}

// Render filter icon with active indicator
function FilterIcon({
  columnId,
  filterState,
  filterConfig,
}: {
  columnId: string;
  filterState?: FilterState;
  filterConfig?: FilterConfig;
}) {
  const isActive = hasActiveFilter(columnId, filterState, filterConfig);
  return (
    <div className="relative">
      <Filter
        className={cn(
          'w-4 h-4 transition-colors',
          isActive ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
        )}
      />
      {isActive && <div className="absolute -top-1 -right-1 w-2 h-2 bg-teal-600 rounded-full" />}
    </div>
  );
}

// Render sort icon
function SortIcon({ columnId, sortState }: { columnId: string; sortState?: SortState }) {
  if (sortState?.column !== columnId) {
    return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
  }
  return sortState.direction === 'asc' ? (
    <ChevronUp className="w-4 h-4 text-gray-600" />
  ) : (
    <ChevronDown className="w-4 h-4 text-gray-600" />
  );
}

// Column header with sort and filter
interface ColumnHeaderProps {
  columnId: string;
  title: string;
  sortable?: boolean;
  sortState?: SortState;
  onSortChange?: (sort: SortState) => void;
  filterConfig?: FilterConfig;
  filterState?: FilterState;
  onFilterChange?: (filters: FilterState) => void;
  filterOptions?: Array<{ value: string; label: string }>;
}

function ColumnHeader({
  columnId,
  title,
  sortable = false,
  sortState,
  onSortChange,
  filterConfig,
  filterState,
  onFilterChange,
  filterOptions,
}: ColumnHeaderProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  const handleSort = () => {
    if (!sortable || !onSortChange) return;
    const newDirection =
      sortState?.column === columnId && sortState.direction === 'asc' ? 'desc' : 'asc';
    onSortChange({ column: columnId, direction: newDirection });
  };

  const handleFilterChange = (value: unknown) => {
    if (!onFilterChange) return;
    onFilterChange({ ...filterState, [columnId]: value });
  };

  const handleFilterClear = () => {
    if (!onFilterChange || !filterConfig) return;
    let defaultValue: unknown;
    switch (filterConfig.type) {
      case 'text':
        defaultValue = { text: '' };
        break;
      case 'checkbox':
        defaultValue = [];
        break;
      case 'date':
        defaultValue = { range: 'all', customStart: null, customEnd: null };
        break;
      default:
        defaultValue = undefined;
    }
    onFilterChange({ ...filterState, [columnId]: defaultValue });
  };

  const renderFilter = () => {
    if (!filterConfig || !filterState) return null;
    const value = filterState[columnId];

    switch (filterConfig.type) {
      case 'text':
        return (
          <TextFilter
            value={(value as TextFilterValue) || { text: '' }}
            onChange={handleFilterChange}
            onClear={handleFilterClear}
            title={`Filter by ${title}`}
            placeholder={filterConfig.placeholder || `Search ${title.toLowerCase()}...`}
            checkboxOptions={filterConfig.checkboxOptions}
          />
        );
      case 'checkbox':
        return (
          <CheckboxFilter
            value={(value as string[]) || []}
            onChange={handleFilterChange}
            onClear={handleFilterClear}
            title={`Filter by ${title}`}
            options={filterOptions || filterConfig.options || []}
            searchable={true}
            searchPlaceholder={`Search ${title.toLowerCase()}...`}
          />
        );
      case 'date':
        return (
          <DateFilter
            value={
              (value as DateFilterValue) || {
                range: 'all',
                customStart: null,
                customEnd: null,
              }
            }
            onChange={handleFilterChange}
            onClear={handleFilterClear}
            title={`Filter by ${title}`}
          />
        );
      case 'custom':
        return filterConfig.render?.({
          value,
          onChange: handleFilterChange,
          onClear: handleFilterClear,
        });
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-2">
      {sortable ? (
        <Button
          variant="ghost"
          className="h-auto p-0 font-medium text-base hover:bg-transparent flex-1"
          onClick={handleSort}
        >
          <div className="flex items-center gap-2">
            {title}
            <SortIcon columnId={columnId} sortState={sortState} />
          </div>
        </Button>
      ) : (
        <span className="font-medium text-base">{title}</span>
      )}
      {filterConfig && (
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-gray-100">
              <FilterIcon
                columnId={columnId}
                filterState={filterState}
                filterConfig={filterConfig}
              />
            </Button>
          </PopoverTrigger>
          {renderFilter()}
        </Popover>
      )}
    </div>
  );
}

// Actions cell renderer
function ActionsCell<TData>({
  row,
  actions,
  renderPrimaryActions,
  moreIconVariant = 'vertical',
}: {
  row: TData;
  actions?: ActionMenuItem<TData>[];
  renderPrimaryActions?: (row: TData) => ReactNode;
  moreIconVariant?: 'vertical' | 'horizontal';
}) {
  if (!actions && !renderPrimaryActions) return null;

  const MoreIcon = moreIconVariant === 'horizontal' ? MoreHorizontal : MoreVertical;

  // Filter visible actions
  const visibleActions = actions?.filter((action) => {
    if (typeof action.hidden === 'function') return !action.hidden(row);
    return !action.hidden;
  });

  return (
    <div className="flex items-center gap-2">
      {renderPrimaryActions?.(row)}
      {visibleActions && visibleActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0 hover:bg-gray-100">
              <MoreIcon className="w-4 h-4 text-gray-600" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {visibleActions.map((action, index) => {
              const isDisabled =
                typeof action.disabled === 'function' ? action.disabled(row) : action.disabled;
              const label = typeof action.label === 'function' ? action.label(row) : action.label;
              const icon = typeof action.icon === 'function' ? action.icon(row) : action.icon;

              // Section header
              if (action.isHeader) {
                return (
                  <div
                    key={action.id}
                    className="px-2 py-1.5 text-xs text-muted-foreground font-medium"
                  >
                    {label}
                  </div>
                );
              }

              const menuItem = (
                <DropdownMenuItem
                  key={action.id}
                  onClick={() => action.onClick?.(row)}
                  disabled={isDisabled}
                  className={cn(
                    'cursor-pointer',
                    action.variant === 'destructive' && 'text-destructive focus:text-destructive'
                  )}
                  onSelect={action.render ? (e) => e.preventDefault() : undefined}
                >
                  {icon && <span className="mr-2">{icon}</span>}
                  {label}
                </DropdownMenuItem>
              );

              const separatorBefore =
                action.separator === 'before' && index > 0 ? (
                  <DropdownMenuSeparator key={`sep-before-${action.id}`} />
                ) : null;

              const separatorAfter =
                action.separator === 'after' && index < visibleActions.length - 1 ? (
                  <DropdownMenuSeparator key={`sep-after-${action.id}`} />
                ) : null;

              // Wrap with custom render if provided (for dialogs)
              const finalMenuItem = action.render ? action.render(row, menuItem) : menuItem;

              return (
                <span key={action.id}>
                  {separatorBefore}
                  {finalMenuItem}
                  {separatorAfter}
                </span>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function DataTable<TData>({
  data,
  columns,
  isLoading = false,
  isError = false,
  errorMessage = 'Failed to load data',
  onRetry,
  getRowId,
  pinnedRows,
  sortState,
  filterState,
  filterConfigs,
  activeFilterCount = 0,
  onClearAllFilters,
  selection,
  pagination,
  emptyState,
  skeleton,
  className,
  tableClassName,
  idPrefix = 'table',
}: DataTableProps<TData>) {
  // Pagination state managed by TanStack Table
  const [paginationState, setPaginationState] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pagination?.initialPageSize ?? 10,
  });

  // Create TanStack table instance with pagination
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
    onPaginationChange: pagination ? setPaginationState : undefined,
    state: {
      pagination: pagination ? paginationState : undefined,
    },
    getRowId: (row) => String(getRowId(row)),
  });

  // Get paginated rows - no useMemo since table.getRowModel() returns fresh data each render
  const paginatedRows = table.getRowModel().rows;

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground">{errorMessage}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  const totalRows = pagination?.totalRows ?? data.length;
  const hasData = data.length > 0 || (pinnedRows && pinnedRows.length > 0);

  return (
    <div className={cn('h-full flex flex-col min-h-0', className)}>
      {/* Selection bar - fixed at top */}
      {selection?.enabled && (
        <div className="flex-shrink-0">
          <DataTableSelectionBar selection={selection} idPrefix={idPrefix} />
        </div>
      )}

      {/* Filter summary - fixed at top */}
      {activeFilterCount > 0 && onClearAllFilters && (
        <div className="flex-shrink-0">
          <DataTableFilterSummary
            activeFilterCount={activeFilterCount}
            onClearAll={onClearAllFilters}
            idPrefix={idPrefix}
          />
        </div>
      )}

      {/* Scrollable table area */}
      <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
        {isLoading && skeleton ? (
          <DataTableSkeleton config={skeleton} />
        ) : hasData ? (
          <div className={cn('border rounded-lg bg-white overflow-hidden', tableClassName)}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-gray-50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-gray-50 hover:bg-gray-50">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn('bg-gray-50', header.column.columnDef.meta?.headerClassName)}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {/* Render pinned rows first (if any) */}
                {pinnedRows?.map((pinnedRow) => (
                  <TableRow
                    key={`pinned-${getRowId(pinnedRow)}`}
                    className="hover:bg-gray-50 bg-blue-50/30"
                  >
                    {columns.map((column) => {
                      const columnId =
                        column.id || (column as { accessorKey?: string }).accessorKey || 'unknown';
                      return (
                        <TableCell
                          key={`pinned-${getRowId(pinnedRow)}-${columnId}`}
                          className={cn('py-4', column.meta?.cellClassName)}
                        >
                          {column.cell
                            ? typeof column.cell === 'function'
                              ? (column.cell as (info: { row: { original: TData } }) => ReactNode)({
                                  row: { original: pinnedRow },
                                })
                              : null
                            : null}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {/* Render regular paginated rows */}
                {paginatedRows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn('py-4', cell.column.columnDef.meta?.cellClassName)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : emptyState ? (
          <DataTableEmptyState
            config={emptyState}
            hasFilters={activeFilterCount > 0}
            idPrefix={idPrefix}
          />
        ) : null}
      </div>

      {/* Pagination - fixed at bottom */}
      {pagination && (
        <div className="flex-shrink-0">
          <DataTablePagination
            table={table}
            totalRows={totalRows}
            pageSizeOptions={pagination.pageSizeOptions}
            idPrefix={idPrefix}
          />
        </div>
      )}
    </div>
  );
}

// Export helper components for building columns
export { ColumnHeader, ActionsCell, FilterIcon, SortIcon };
