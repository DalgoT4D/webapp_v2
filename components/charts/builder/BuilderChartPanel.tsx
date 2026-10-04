'use client';

import { ChartPreview } from '@/components/charts/ChartPreview';
import { MapPreview } from '@/components/charts/chart-types/map/MapPreview';
import {
  BuilderTableView,
  type BuilderTableViewProps,
} from '@/components/charts/builder/BuilderTableView';
import type { ChartBuilderFormData } from '@/types/charts';
import type { ChartBuilderKind } from '@/components/charts/logic/builder-kind';
import type { useBuilderMapPreview } from '@/components/charts/hooks/useBuilderMapPreview';
import type { useMapDrillDown } from '@/components/charts/hooks/useMapDrillDown';
import type { useChartPreviewData } from '@/components/charts/hooks/useChartPreviewData';

export type MapPanelData = ReturnType<typeof useBuilderMapPreview> &
  ReturnType<typeof useMapDrillDown>;

interface BuilderChartPanelProps {
  builder: ChartBuilderKind;
  config: ChartBuilderFormData;
  map: MapPanelData;
  table: Omit<BuilderTableViewProps, 'builder' | 'config'>;
  chart: {
    /** Same value the pages read from useChartPreviewData (pivot rows live in `data.data`). */
    data?: ReturnType<typeof useChartPreviewData>['chartData'];
    isLoading: boolean;
    error: unknown;
    lastValidConfig: Record<string, unknown> | null;
  };
}

/** The builder's CHART tab body: map, table chart or ECharts/pivot preview by chart type. */
export function BuilderChartPanel({ builder, config, map, table, chart }: BuilderChartPanelProps) {
  if (config.chart_type === 'map') {
    return (
      <div className="w-full h-full">
        <MapPreview
          geojsonData={map.geojsonData?.geojson_data}
          geojsonLoading={map.geojsonLoading}
          geojsonError={map.geojsonError}
          mapData={map.mapDataOverlay?.data}
          mapDataLoading={map.mapDataLoading}
          mapDataError={map.mapDataError}
          valueColumn={config.metrics?.[0]?.alias || config.aggregate_column}
          customizations={config.customizations}
          onRegionClick={map.handleRegionClick}
          drillDownPath={map.drillDownPath}
          onDrillUp={map.handleDrillUp}
          onDrillHome={map.handleDrillHome}
          // BUILDER-DRIFT: only the create page passes showBreadcrumbs
          {...(builder === 'create' && { showBreadcrumbs: true })}
        />
      </div>
    );
  }

  if (config.chart_type === 'table') {
    return <BuilderTableView builder={builder} config={config} {...table} />;
  }

  const isPivot = config.chart_type === 'pivot_table';
  return (
    <div className="w-full h-full">
      <ChartPreview
        key={`${config.schema_name}-${config.table_name}`}
        config={
          isPivot
            ? { extra_config: config.extra_config }
            : // BUILDER-DRIFT: edit keeps showing the last good ECharts config while a new one loads
              builder === 'edit'
              ? chart.data?.echarts_config || chart.lastValidConfig
              : chart.data?.echarts_config
        }
        tableData={isPivot ? chart.data?.data : undefined}
        isLoading={chart.isLoading}
        // BUILDER-DRIFT: edit reports chart errors through its overlay, never in the preview
        error={builder === 'edit' ? null : chart.error}
        chartType={config.chart_type}
        customizations={config.customizations}
      />
    </div>
  );
}
