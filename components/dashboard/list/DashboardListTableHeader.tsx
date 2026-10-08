'use client';

import { TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableColumnHeader } from '@/components/list-page/SortableColumnHeader';
import { ColumnFilterPopover } from '@/components/list-page/ColumnFilterPopover';
import { DateModifiedFilter } from '@/components/list-page/DateModifiedFilter';
import { createEmptyDateFilter, type SortOrder } from '@/components/list-page/list-logic';
import { createEmptyDashboardNameFilters, type DashboardSortColumn } from './dashboard-list-logic';
import type { DashboardListFilters } from './useDashboardListFilters';
import {
  DashboardNameFilterContent,
  DashboardOwnerFilterContent,
} from './DashboardListFilterContents';

interface DashboardListTableHeaderProps {
  sortBy: DashboardSortColumn;
  sortOrder: SortOrder;
  onSort: (column: DashboardSortColumn) => void;
  filters: DashboardListFilters;
  uniqueOwners: string[];
}

/** Sortable, filterable header row of the dashboard list table. */
export function DashboardListTableHeader({
  sortBy,
  sortOrder,
  onSort,
  filters,
  uniqueOwners,
}: DashboardListTableHeaderProps) {
  const sort = { sortBy, sortOrder, onSort };
  return (
    <TableHeader>
      <TableRow className="bg-gray-50">
        <TableHead className="w-[40%]">
          <div className="flex items-center gap-2">
            <SortableColumnHeader
              {...sort}
              label="Name"
              column="name"
              testId="dashboard-list-sort-name"
              isLeftAligned
            />
            <ColumnFilterPopover
              isOpen={filters.openFilters.name}
              onOpenChange={(open) => filters.setFilterOpen('name', open)}
              isActive={filters.activeFilters.name}
              triggerTestId="dashboard-list-filter-name-trigger"
              title="Filter by Name"
              onClear={() => filters.setNameFilters(createEmptyDashboardNameFilters())}
              clearTestId="dashboard-list-name-filter-clear"
              contentClassName="w-80"
            >
              <DashboardNameFilterContent
                nameFilters={filters.nameFilters}
                setNameFilters={filters.setNameFilters}
              />
            </ColumnFilterPopover>
          </div>
        </TableHead>
        <TableHead className="w-[35%]">
          <div className="flex items-center gap-2">
            <SortableColumnHeader
              {...sort}
              label="Owner"
              column="created_by"
              testId="dashboard-list-sort-owner"
              isLeftAligned
            />
            <ColumnFilterPopover
              isOpen={filters.openFilters.owner}
              onOpenChange={(open) => filters.setFilterOpen('owner', open)}
              isActive={filters.activeFilters.owner}
              triggerTestId="dashboard-list-filter-owner-trigger"
              title="Filter by Owner"
              onClear={() => filters.setOwnerFilters([])}
              clearTestId="dashboard-list-owner-filter-clear"
              contentClassName="w-64"
            >
              <DashboardOwnerFilterContent
                options={uniqueOwners}
                selected={filters.ownerFilters}
                setSelected={filters.setOwnerFilters}
                search={filters.ownerSearch}
                onSearchChange={filters.setOwnerSearch}
              />
            </ColumnFilterPopover>
          </div>
        </TableHead>
        <TableHead className="w-[15%]">
          <div className="flex items-center gap-2">
            <SortableColumnHeader
              {...sort}
              label="Last Modified"
              column="updated_at"
              testId="dashboard-list-sort-modified"
              isLeftAligned
            />
            <ColumnFilterPopover
              isOpen={filters.openFilters.date}
              onOpenChange={(open) => filters.setFilterOpen('date', open)}
              isActive={filters.activeFilters.date}
              triggerTestId="dashboard-list-filter-date-trigger"
              title="Filter by Date Modified"
              onClear={() => filters.setDateFilters(createEmptyDateFilter())}
              clearTestId="dashboard-list-date-filter-clear"
              contentClassName="w-72"
            >
              <DateModifiedFilter
                value={filters.dateFilters}
                onChange={filters.setDateFilters}
                optionTestIdPrefix="dashboard-list-date-filter"
                fromTestId="dashboard-list-date-filter-start"
                toTestId="dashboard-list-date-filter-end"
                dateInputMode="local-date"
              />
            </ColumnFilterPopover>
          </div>
        </TableHead>
        <TableHead className="w-[10%] font-medium text-base">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
}
