'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  useChart,
  useChartData,
  useChartDataPreview,
  useGeoJSONData,
  useMapDataOverlay,
  useChildRegions,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import { ChartPreview } from '@/components/charts/ChartPreview';
import { DataPreview } from '@/components/charts/DataPreview';
import { MapPreview } from '@/components/charts/map/MapPreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Edit } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChartExportDropdown } from '@/components/charts/ChartExportDropdown';
import type { ChartDataPayload } from '@/types/charts';
import * as echarts from 'echarts';

interface ChartDetailClientProps {
  chartId: number;
}

interface SelectedRegion {
  region_id: number;
  region_name: string;
  geojson_id?: number;
  geojson_name?: string;
}

interface DrillDownLevel {
  level: number;
  name: string;
  geographic_column: string;
  geojson_id: number;
  region_id?: number;
  parent_selections: Array<{
    column: string;
    value: string;
  }>;
}

export function ChartDetailClient({ chartId }: ChartDetailClientProps) {
  const { data: chart, error: chartError, isLoading: chartLoading } = useChart(chartId);
  const [drillDownPath, setDrillDownPath] = useState<DrillDownLevel[]>([]);

  // Build payload for chart data
  const chartDataPayload: ChartDataPayload | null = chart
    ? {
        chart_type: chart.chart_type,
        computation_type: chart.computation_type,
        schema_name: chart.schema_name,
        table_name: chart.table_name,
        x_axis: chart.extra_config?.x_axis_column,
        y_axis: chart.extra_config?.y_axis_column,
        dimension_col: chart.extra_config?.dimension_column,
        aggregate_col: chart.extra_config?.aggregate_column,
        aggregate_func: chart.extra_config?.aggregate_function || 'sum',
        extra_dimension: chart.extra_config?.extra_dimension_column,
        // Map-specific fields
        geographic_column: chart.extra_config?.geographic_column,
        value_column: chart.extra_config?.value_column,
        selected_geojson_id:
          chart.extra_config?.selected_geojson_id ||
          (chart.chart_type === 'map' && chart.extra_config?.layers?.[0]?.geojson_id
            ? chart.extra_config.layers[0].geojson_id
            : undefined),
        // For map charts, also set dimension_col to geographic_column for compatibility
        ...(chart.chart_type === 'map' && {
          dimension_col: chart.extra_config?.geographic_column,
          aggregate_col: chart.extra_config?.aggregate_column || chart.extra_config?.value_column,
        }),
        customizations: chart.extra_config?.customizations || {},
        // Include metrics for multiple metrics support
        metrics: chart.extra_config?.metrics,
        extra_config: {
          filters: chart.extra_config?.filters,
          pagination: chart.extra_config?.pagination,
          sort: chart.extra_config?.sort,
        },
      }
    : null;

  // For non-map charts, use the standard chart data hook
  const {
    data: chartData,
    error: dataError,
    isLoading: dataLoading,
  } = useChartData(
    chart?.chart_type !== 'map' && chart?.chart_type !== 'table' ? chartDataPayload : null
  );

  // For table charts, use data preview API
  const {
    data: tableData,
    error: tableError,
    isLoading: tableLoading,
  } = useChartDataPreview(chart?.chart_type === 'table' ? chartDataPayload : null, 1, 50);

  // Determine current level for drill-down
  const currentLevel = drillDownPath.length;
  const currentLayer =
    chart?.chart_type === 'map' && chart?.extra_config?.layers
      ? chart.extra_config.layers[currentLevel]
      : null;

  // For map charts, determine which geojson and data to fetch based on drill-down state
  let activeGeojsonId = null;
  let activeGeographicColumn = null;

  if (chart?.chart_type === 'map') {
    if (drillDownPath.length > 0) {
      // We're in a drill-down state, use the geojson from the last drill-down level
      const lastDrillDown = drillDownPath[drillDownPath.length - 1];
      activeGeojsonId = lastDrillDown.geojson_id;
      activeGeographicColumn = lastDrillDown.geographic_column;
    } else if (currentLayer) {
      // Use current layer configuration (first layer)
      activeGeojsonId = currentLayer.geojson_id;
      activeGeographicColumn = currentLayer.geographic_column;
    } else {
      // Fallback to first layer or original configuration
      const firstLayer = chart.extra_config?.layers?.[0];
      activeGeojsonId = firstLayer?.geojson_id || chart.extra_config?.selected_geojson_id;
      activeGeographicColumn =
        firstLayer?.geographic_column || chart.extra_config?.geographic_column;
    }
  }

  const {
    data: geojsonData,
    error: geojsonError,
    isLoading: geojsonLoading,
  } = useGeoJSONData(activeGeojsonId);

  // Build data overlay payload for map charts based on current level
  // Include filters for drill-down selections - flatten all parent selections
  const filters = useMemo(() => {
    const filterObj: Record<string, string> = {};
    if (drillDownPath.length > 0) {
      // Collect all parent selections from the drill-down path
      drillDownPath.forEach((level) => {
        level.parent_selections.forEach((selection) => {
          filterObj[selection.column] = selection.value;
        });
      });
    }
    return filterObj;
  }, [drillDownPath]);

  const mapDataOverlayPayload = useMemo(() => {
    return chart?.chart_type === 'map' && chart.extra_config && activeGeographicColumn
      ? {
          schema_name: chart.schema_name,
          table_name: chart.table_name,
          geographic_column: activeGeographicColumn,
          value_column: chart.extra_config.aggregate_column || chart.extra_config.value_column,
          aggregate_function: chart.extra_config.aggregate_function || 'sum',
          filters: filters, // Drill-down filters
          chart_filters: chart.extra_config.filters || [], // Chart-level filters
          // Include full extra_config for pagination, sorting, and other features
          extra_config: {
            filters: chart.extra_config.filters || [],
            pagination: chart.extra_config.pagination,
            sort: chart.extra_config.sort,
          },
        }
      : null;
  }, [
    chart?.chart_type,
    chart?.schema_name,
    chart?.table_name,
    chart?.extra_config,
    activeGeographicColumn,
    filters,
  ]);

  const {
    data: mapDataOverlay,
    error: mapDataError,
    isLoading: mapDataLoading,
  } = useMapDataOverlay(mapDataOverlayPayload);

  // Show toast notifications for filtered states when map shows empty state
  useEffect(() => {
    if (
      chart?.chart_type === 'map' &&
      chart.extra_config?.filters &&
      chart.extra_config.filters.length > 0 &&
      !geojsonData?.geojson_data &&
      !geojsonLoading &&
      !geojsonError
    ) {
      // Show toast for each applied filter
      chart.extra_config.filters.forEach((filter: any, index: number) => {
        const operatorText =
          filter.operator === 'not equals' || filter.operator === '!=' ? 'excluded' : 'filtered';

        setTimeout(() => {
          toast.info(`🗺️ ${filter.value} ${operatorText} from map`, {
            description: `Filter: ${filter.column} ${filter.operator} ${filter.value}`,
            duration: 5000,
            position: 'top-right',
          });
        }, index * 500); // Stagger toasts by 500ms
      });

      // Show additional helpful toast
      setTimeout(
        () => {
          toast('💡 Configure drill-down layers to see filtered regions', {
            description: "Click 'Edit Chart' to set up geographic layers",
            duration: 7000,
            position: 'top-right',
            action: {
              label: 'Edit Chart',
              onClick: () => (window.location.href = `/charts/${chartId}/edit`),
            },
          });
        },
        chart.extra_config.filters.length * 500 + 1000
      ); // Show after all filter toasts
    }
  }, [chart, geojsonData, geojsonLoading, geojsonError, chartId]);

  // Chart refs for export
  const [chartElement, setChartElement] = useState<HTMLElement | null>(null);
  const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(null);
  const chartContentRef = useRef<HTMLDivElement>(null);

  // Update chart element ref when content is rendered
  useEffect(() => {
    if (chartContentRef.current) {
      setChartElement(chartContentRef.current);
    }
  }, [chart, chartData, mapDataOverlay]);

  // Handle region click for drill-down
  const handleRegionClick = (regionName: string, regionData: any) => {
    if (!chart?.extra_config?.layers || chart.chart_type !== 'map') return;

    const nextLevel = currentLevel + 1;
    const nextLayer = chart.extra_config.layers[nextLevel];

    if (!nextLayer) {
      // No next layer configured
      toast.info('🗺️ No further drill-down levels configured', {
        description: 'Configure additional layers in edit mode to enable deeper drill-down',
        position: 'top-right',
      });
      return;
    }

    // Check if the clicked region is configured in the next layer
    let nextGeojsonId = nextLayer.geojson_id;
    let isRegionConfigured = false;

    if (nextLayer.selected_regions && nextLayer.selected_regions.length > 0) {
      // Find the region that matches the clicked region name
      const matchingRegion = nextLayer.selected_regions.find(
        (region: SelectedRegion) => region.region_name === regionName
      );

      if (matchingRegion && matchingRegion.geojson_id) {
        nextGeojsonId = matchingRegion.geojson_id;
        isRegionConfigured = true;
      }
    } else if (nextLayer.geojson_id) {
      // Single-select layer - check if this region is the configured one
      isRegionConfigured = true; // For single-select, we assume it's configured
    }

    // If region is not configured, show toast and prevent drill-down
    if (!isRegionConfigured) {
      // Check if region is filtered out
      const chartFilters = chart.extra_config?.filters || [];
      const isFiltered = chartFilters.some(
        (filter: any) =>
          (filter.operator === 'not equals' || filter.operator === '!=') &&
          filter.value === regionName
      );

      if (isFiltered) {
        toast.warning(`🚫 ${regionName} excluded by filter`, {
          description: `This region is filtered out and not available for drill-down`,
          position: 'top-right',
          duration: 4000,
        });
      } else {
        toast.info(`🗺️ ${regionName} not configured for drill-down`, {
          description: 'Configure this region in edit mode to enable drill-down',
          position: 'top-right',
          duration: 4000,
          action: {
            label: 'Edit Chart',
            onClick: () => (window.location.href = `/charts/${chartId}/edit`),
          },
        });
      }
      return; // Prevent drill-down
    }

    // Create new drill-down level
    const newLevel: DrillDownLevel = {
      level: nextLevel,
      name: regionName,
      geographic_column: nextLayer.geographic_column || '',
      geojson_id: nextGeojsonId || 0,
      region_id: nextLayer.region_id,
      parent_selections: [
        ...drillDownPath.flatMap((level) => level.parent_selections),
        {
          column: activeGeographicColumn || '',
          value: regionName,
        },
      ],
    };

    setDrillDownPath([...drillDownPath, newLevel]);
  };

  // Handle drill up to a specific level
  const handleDrillUp = (targetLevel: number) => {
    if (targetLevel < 0) {
      setDrillDownPath([]);
    } else {
      setDrillDownPath(drillDownPath.slice(0, targetLevel + 1));
    }
  };

  // Handle drill to home (first level)
  const handleDrillHome = () => {
    setDrillDownPath([]);
  };

  if (chartLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (chartError || !chart) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">
          Failed to load chart. Please try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/charts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{chart.title}</h1>
            <p className="text-muted-foreground mt-1">
              {chart.chart_type} chart • {chart.schema_name}.{chart.table_name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/charts/${chartId}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit Chart
            </Button>
          </Link>
          <ChartExportDropdown
            chartTitle={chart.title}
            chartElement={chartElement}
            chartInstance={chartInstance}
          />
        </div>
      </div>

      <div>
        {/* Chart Preview - Full width */}
        <div>
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle>Chart Preview</CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-5rem)]" ref={chartContentRef}>
              {chart?.chart_type === 'map' ? (
                <MapPreview
                  geojsonData={geojsonData?.geojson_data}
                  geojsonLoading={geojsonLoading}
                  geojsonError={geojsonError}
                  mapData={mapDataOverlay?.data}
                  mapDataLoading={mapDataLoading}
                  mapDataError={mapDataError}
                  title={chart.title}
                  valueColumn={chart.extra_config?.aggregate_column}
                  onRegionClick={handleRegionClick}
                  drillDownPath={drillDownPath}
                  onDrillUp={handleDrillUp}
                  onDrillHome={handleDrillHome}
                />
              ) : chart?.chart_type === 'table' ? (
                <DataPreview
                  data={Array.isArray(tableData?.data) ? tableData.data : []}
                  columns={tableData?.columns || []}
                  columnTypes={tableData?.column_types || {}}
                  isLoading={tableLoading}
                  error={tableError}
                />
              ) : (
                <ChartPreview
                  config={chartData?.echarts_config}
                  isLoading={dataLoading}
                  error={dataError}
                  onChartReady={setChartInstance}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
