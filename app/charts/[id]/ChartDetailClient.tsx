'use client';

import { useState } from 'react';
import {
  useChart,
  useChartData,
  useGeoJSONData,
  useMapDataOverlay,
  useChildRegions,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import { ChartPreview } from '@/components/charts/ChartPreview';
import { MapPreview } from '@/components/charts/map/MapPreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, Edit } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { ChartDataPayload } from '@/types/charts';

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
  } = useChartData(chart?.chart_type !== 'map' ? chartDataPayload : null);

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
  const filters: Record<string, string> = {};
  if (drillDownPath.length > 0) {
    // Collect all parent selections from the drill-down path
    drillDownPath.forEach((level) => {
      level.parent_selections.forEach((selection) => {
        filters[selection.column] = selection.value;
      });
    });
  }

  const mapDataOverlayPayload =
    chart?.chart_type === 'map' && chart.extra_config && activeGeographicColumn
      ? {
          schema_name: chart.schema_name,
          table_name: chart.table_name,
          geographic_column: activeGeographicColumn,
          value_column: chart.extra_config.aggregate_column || chart.extra_config.value_column,
          aggregate_function: chart.extra_config.aggregate_function || 'sum',
          filters: filters, // Drill-down filters
          chart_filters: chart.extra_config.filters || [], // Chart-level filters
        }
      : null;

  const {
    data: mapDataOverlay,
    error: mapDataError,
    isLoading: mapDataLoading,
  } = useMapDataOverlay(mapDataOverlayPayload);

  const handleExport = () => {
    // TODO: Implement chart export functionality
    toast.info('Export functionality coming soon');
  };

  // Handle region click for drill-down
  const handleRegionClick = (regionName: string, regionData: any) => {
    if (!chart?.extra_config?.layers || chart.chart_type !== 'map') return;

    const nextLevel = currentLevel + 1;
    const nextLayer = chart.extra_config.layers[nextLevel];

    if (!nextLayer) {
      // No next layer configured
      toast.info('No further drill-down levels configured');
      return;
    }

    // For Layer 2+, we need to find the right GeoJSON based on the clicked region
    // For now, let's use the first configured GeoJSON in the next layer
    // In a more sophisticated implementation, we'd look up the region mapping
    let nextGeojsonId = nextLayer.geojson_id;

    // If this is a multi-select layer (Layer 2+), try to find the right region's GeoJSON
    if (nextLayer.selected_regions && nextLayer.selected_regions.length > 0) {
      // Find the region that matches the clicked region name
      const matchingRegion = nextLayer.selected_regions.find(
        (region: SelectedRegion) => region.region_name === regionName
      );
      if (matchingRegion && matchingRegion.geojson_id) {
        nextGeojsonId = matchingRegion.geojson_id;
      }
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
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Preview - 2/3 width */}
        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle>Chart Preview</CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-5rem)]">
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
              ) : (
                <ChartPreview
                  config={chartData?.echarts_config}
                  isLoading={dataLoading}
                  error={dataError}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Settings - 1/3 width */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-1">Title</h3>
                  <p className="text-sm">{chart.title}</p>
                </div>

                {chart.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">
                      Description
                    </h3>
                    <p className="text-sm">{chart.description}</p>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="capitalize">{chart.chart_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span className="capitalize">{chart.computation_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{new Date(chart.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Updated:</span>
                    <span>{new Date(chart.updated_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Schema:</span>
                    <span>{chart.schema_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Table:</span>
                    <span>{chart.table_name}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
