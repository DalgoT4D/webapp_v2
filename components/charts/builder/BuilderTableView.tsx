'use client';

import { TableChart } from '@/components/charts/chart-types/table/TableChart';
import { TableDrillBreadcrumb } from '@/components/charts/builder/TableDrillBreadcrumb';
import { mergeTableColumnFormatting, resolveTableColumnOrder } from '@/lib/chart-payload-utils';
import { getDrillDownColumns } from '@/components/charts/logic/table-drilldown';
import type { ChartBuilderFormData, DataPreviewResponse } from '@/types/charts';
import type { ChartBuilderKind } from '@/components/charts/logic/builder-kind';
import type { PageState } from '@/components/charts/hooks/usePreviewPagination';
import type { useTableDrillDown } from '@/components/charts/hooks/useTableDrillDown';

/** Fallback when the chart has no pagination config (same in both builders). */
const DEFAULT_TABLE_PAGINATION = { enabled: true, page_size: 20 };

export interface BuilderTableViewProps {
  builder: ChartBuilderKind;
  config: ChartBuilderFormData;
  drill: ReturnType<typeof useTableDrillDown>;
  data?: DataPreviewResponse;
  isLoading: boolean;
  error: unknown;
  page: PageState;
  total: number;
  /** BUILDER-DRIFT: the edit page hides pagination until there is a data payload. */
  showPagination: boolean;
}

export function BuilderTableView({
  builder,
  config,
  drill,
  data,
  isLoading,
  error,
  page,
  total,
  showPagination,
}: BuilderTableViewProps) {
  const tableColumns = resolveTableColumnOrder({
    cols: data?.columns || config.table_columns || [],
    savedOrder: config.customizations?.columnOrder,
    drillDownDimensions: getDrillDownColumns(config.dimensions),
    currentDimensionColumn: drill.currentDimensionColumn,
  });

  return (
    <div className="w-full h-full flex flex-col">
      <TableDrillBreadcrumb state={drill.tableDrillDownState} onBack={drill.handleTableDrillUp} />
      <div className="flex-1 overflow-hidden">
        <TableChart
          data={Array.isArray(data?.data) ? data.data : []}
          config={{
            table_columns: tableColumns,
            column_formatting: mergeTableColumnFormatting(config.customizations),
            // BUILDER-DRIFT: create passes [] for a missing sort, edit passes undefined
            sort: builder === 'create' ? config.sort || [] : config.sort,
            pagination: config.pagination || DEFAULT_TABLE_PAGINATION,
            conditionalFormatting: config.customizations?.conditionalFormatting || [],
            columnAlignment: config.customizations?.columnAlignment || {},
            zebraRows: config.customizations?.zebraRows ?? true,
            freezeFirstColumn: config.customizations?.freezeFirstColumn || false,
            theme: config.customizations?.theme,
          }}
          isLoading={isLoading}
          error={error}
          pagination={
            showPagination
              ? {
                  page: page.page,
                  pageSize: page.pageSize,
                  total,
                  onPageChange: page.setPage,
                  onPageSizeChange: page.changePageSize,
                }
              : undefined
          }
          onRowClick={drill.handleTableRowClick}
          drillDownEnabled={drill.isDrillDownEnabled}
          currentDimensionColumn={drill.currentDimensionColumn}
          // BUILDER-DRIFT: only the edit page passes the drill level (create relies on the default 0)
          {...(builder === 'edit' && { currentDrillLevel: drill.currentDrillLevel })}
        />
      </div>
    </div>
  );
}
