'use client';

import { TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableColumnHeader } from '@/components/list-page/SortableColumnHeader';
import { ColumnFilterPopover } from '@/components/list-page/ColumnFilterPopover';
import { DateModifiedFilter } from '@/components/list-page/DateModifiedFilter';
import { createEmptyDateFilter, type SortOrder } from '@/components/list-page/list-logic';
import { createEmptyChartNameFilters, type ChartSortColumn } from './chart-list-logic';
import type { ChartListFilters } from './useChartListFilters';
import {
  ChartDataSourceFilterContent,
  ChartNameFilterContent,
  ChartTypeFilterContent,
} from './ChartListFilterContents';

interface ChartListTableHeaderProps {
  sortBy: ChartSortColumn;
  sortOrder: SortOrder;
  onSort: (column: ChartSortColumn) => void;
  filters: ChartListFilters;
  uniqueDataSources: string[];
  uniqueChartTypes: string[];
}

/** Sortable, filterable header row of the chart list table. */
export function ChartListTableHeader({
  sortBy,
  sortOrder,
  onSort,
  filters,
  uniqueDataSources,
  uniqueChartTypes,
}: ChartListTableHeaderProps) {
  const sort = { sortBy, sortOrder, onSort };
  return (
    <TableHeader>
      <TableRow className="bg-gray-50">
        <TableHead className="w-[28%]">
          <div className="flex items-center gap-2">
            <SortableColumnHeader
              {...sort}
              label="Name"
              column="title"
              testId="chart-list-sort-name"
              isLeftAligned
            />
            <ColumnFilterPopover
              isOpen={filters.openFilters.name}
              onOpenChange={(open) => filters.setFilterOpen('name', open)}
              isActive={filters.activeFilters.name}
              triggerTestId="chart-list-filter-name-trigger"
              title="Filter by Name"
              onClear={() => filters.setNameFilters(createEmptyChartNameFilters())}
              clearTestId="chart-list-filter-name-clear"
              contentClassName="w-80"
            >
              <ChartNameFilterContent
                nameFilters={filters.nameFilters}
                setNameFilters={filters.setNameFilters}
              />
            </ColumnFilterPopover>
          </div>
        </TableHead>
        <TableHead className="w-[18%]">
          <div className="flex items-center gap-2">
            <SortableColumnHeader
              {...sort}
              label="Data Source"
              column="data_source"
              testId="chart-list-sort-data-source"
            />
            <ColumnFilterPopover
              isOpen={filters.openFilters.dataSource}
              onOpenChange={(open) => filters.setFilterOpen('dataSource', open)}
              isActive={filters.activeFilters.dataSource}
              triggerTestId="chart-list-filter-source-trigger"
              title="Filter by Data Source"
              onClear={() => filters.setDataSourceFilters([])}
              clearTestId="chart-list-filter-source-clear"
              contentClassName="w-64"
            >
              <ChartDataSourceFilterContent
                options={uniqueDataSources}
                selected={filters.dataSourceFilters}
                setSelected={filters.setDataSourceFilters}
                search={filters.dataSourceSearch}
                onSearchChange={filters.setDataSourceSearch}
              />
            </ColumnFilterPopover>
          </div>
        </TableHead>
        <TableHead className="w-[8%]">
          <div className="flex items-center gap-2">
            <SortableColumnHeader
              {...sort}
              label="Type"
              column="chart_type"
              testId="chart-list-sort-type"
            />
            <ColumnFilterPopover
              isOpen={filters.openFilters.chartType}
              onOpenChange={(open) => filters.setFilterOpen('chartType', open)}
              isActive={filters.activeFilters.chartType}
              triggerTestId="chart-list-filter-type-trigger"
              title="Filter by Chart Type"
              onClear={() => filters.setChartTypeFilters([])}
              clearTestId="chart-list-filter-type-clear"
              contentClassName="w-56"
            >
              <ChartTypeFilterContent
                options={uniqueChartTypes}
                selected={filters.chartTypeFilters}
                setSelected={filters.setChartTypeFilters}
              />
            </ColumnFilterPopover>
          </div>
        </TableHead>
        <TableHead className="w-[18%] font-medium text-base">Created by</TableHead>
        <TableHead className="w-[14%]">
          <div className="flex items-center gap-2">
            <SortableColumnHeader
              {...sort}
              label="Last Modified"
              column="updated_at"
              testId="chart-list-sort-updated-at"
            />
            <ColumnFilterPopover
              isOpen={filters.openFilters.date}
              onOpenChange={(open) => filters.setFilterOpen('date', open)}
              isActive={filters.activeFilters.date}
              triggerTestId="chart-list-filter-date-trigger"
              title="Filter by Date Modified"
              onClear={() => filters.setDateFilters(createEmptyDateFilter())}
              clearTestId="chart-list-filter-date-clear"
              contentClassName="w-72"
            >
              <DateModifiedFilter
                value={filters.dateFilters}
                onChange={filters.setDateFilters}
                optionTestIdPrefix="chart-list-filter-date"
                fromTestId="chart-list-filter-date-from"
                toTestId="chart-list-filter-date-to"
                dateInputMode="iso-date"
              />
            </ColumnFilterPopover>
          </div>
        </TableHead>
        <TableHead className="w-[14%] font-medium text-base">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
}
