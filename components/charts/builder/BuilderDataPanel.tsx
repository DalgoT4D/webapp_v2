'use client';

import { BarChart3, Database } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartPreview } from '@/components/charts/ChartPreview';
import { DataPreview } from '@/components/charts/DataPreview';
import type { ChartBuilderFormData } from '@/types/charts';
import type { ChartBuilderKind } from '@/components/charts/logic/builder-kind';
import type { useChartPreviewData } from '@/components/charts/hooks/useChartPreviewData';
import type { usePreviewPagination } from '@/components/charts/hooks/usePreviewPagination';

/** BUILDER-DRIFT: the DATA tab's inner tabs differ only in these class strings — kept verbatim. */
const TAB_CLASSES: Record<ChartBuilderKind, { list: string; content: string }> = {
  create: { list: 'grid w-full grid-cols-2', content: 'flex-1' },
  edit: { list: 'grid w-full grid-cols-2 flex-shrink-0', content: 'flex-1 overflow-auto' },
};

interface BuilderDataPanelProps {
  builder: ChartBuilderKind;
  config: ChartBuilderFormData;
  preview: ReturnType<typeof useChartPreviewData>;
  pages: ReturnType<typeof usePreviewPagination>;
}

/** The builder's DATA tab body: "Chart Data" (or the pivot) and "Raw Data". */
export function BuilderDataPanel({ builder, config, preview, pages }: BuilderDataPanelProps) {
  const css = TAB_CLASSES[builder];
  const isPivot = config.chart_type === 'pivot_table';
  const rawRows = preview.rawTableData;

  return (
    <Tabs
      defaultValue={config.chart_type === 'table' || isPivot ? 'raw-data' : 'chart-data'}
      className="h-full flex flex-col"
    >
      <TabsList className={css.list}>
        <TabsTrigger
          value="chart-data"
          className="flex items-center gap-2"
          data-testid="chart-data-tab-chart-data"
        >
          <BarChart3 className="h-4 w-4" />
          Chart Data
        </TabsTrigger>
        <TabsTrigger
          value="raw-data"
          className="flex items-center gap-2"
          data-testid="chart-data-tab-raw-data"
        >
          <Database className="h-4 w-4" />
          Raw Data
        </TabsTrigger>
      </TabsList>

      <TabsContent value="chart-data" className={css.content}>
        {isPivot ? (
          <ChartPreview
            config={{ extra_config: config.extra_config }}
            tableData={preview.chartData?.data}
            isLoading={preview.chartDataLoading}
            // BUILDER-DRIFT: edit never shows the chart error here
            error={builder === 'edit' ? null : preview.chartDataError}
            chartType={config.chart_type}
            customizations={config.customizations}
          />
        ) : (
          <DataPreview
            data={Array.isArray(preview.dataPreview?.data) ? preview.dataPreview.data : []}
            columns={preview.dataPreview?.columns || []}
            columnTypes={preview.dataPreview?.column_types || {}}
            isLoading={preview.previewLoading}
            error={preview.previewError}
            pagination={{
              page: pages.dataPreview.page,
              pageSize: pages.dataPreview.pageSize,
              total: preview.chartDataTotalRows || 0,
              onPageChange: pages.dataPreview.setPage,
              onPageSizeChange: pages.dataPreview.changePageSize,
            }}
          />
        )}
      </TabsContent>

      <TabsContent value="raw-data" className={css.content}>
        <DataPreview
          data={Array.isArray(rawRows) ? rawRows : []}
          columns={rawRows && rawRows.length > 0 ? Object.keys(rawRows[0]) : []}
          columnTypes={{}}
          isLoading={preview.rawDataLoading}
          error={preview.rawDataError}
          pagination={
            preview.tableCount
              ? {
                  page: pages.rawData.page,
                  pageSize: pages.rawData.pageSize,
                  total: preview.tableCount.total_rows || 0,
                  onPageChange: pages.rawData.setPage,
                  onPageSizeChange: pages.rawData.changePageSize,
                }
              : undefined
          }
        />
      </TabsContent>
    </Tabs>
  );
}
