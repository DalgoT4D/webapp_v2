'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  useChart,
  useChartData,
  useChartDataPreview,
  useChartDataPreviewTotalRows,
  useGeoJSONData,
  useMapDataOverlay,
  useRegionGeoJSONs,
  useRegions,
} from '@/hooks/api/useChart';
import { ChartPreview } from '@/components/charts/ChartPreview';
import { TableChart } from '@/components/charts/TableChart';
import { MapPreview } from '@/components/charts/map/MapPreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Edit, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ChartExportDropdown } from '@/components/charts/ChartExportDropdown';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import type { ChartDataPayload } from '@/types/charts';
import type * as echarts from 'echarts';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFromDashboard = searchParams.get('from') === 'dashboard';
  const { hasPermission } = useUserPermissions();
  const { data: chart, error: chartError, isLoading: chartLoading } = useChart(chartId);
  const [drillDownPath, setDrillDownPath] = useState<DrillDownLevel[]>([]);
  const [tableChartPage, setTableChartPage] = useState(1);
  const [tableChartPageSize, setTableChartPageSize] = useState(20);

  // ✅ ADD: Drill-down state management for table charts
  const [tableDrillDownState, setTableDrillDownState] = useState<{
    currentLevel: number; // 0 = first dimension, 1 = second dimension, etc.
    appliedFilters: Record<string, string>; // { dimension_column: value }
  } | null>(null);

  // Check if user has view permissions
  if (!hasPermission('can_view_charts')) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have permission to view charts.</p>
          <Button variant="outline" onClick={() => router.push('/charts')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Charts
          </Button>
        </div>
      </div>
    );
  }

  // Fetch regions data for dynamic geojson lookup (for Indian maps)
  const { data: regions } = useRegions('IND', 'state');

  // Build payload for chart data - use useMemo to update when drill-down state changes
  const chartDataPayload: ChartDataPayload | null = useMemo(
    () =>
      chart
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
              aggregate_col:
                chart.extra_config?.aggregate_column || chart.extra_config?.value_column,
            }),
            // For table charts, include dimensions array with drill-down support
            ...(chart.chart_type === 'table' && {
              dimensions: (() => {
                const isDrillDownEnabled = chart.extra_config?.dimensions?.some(
                  (dim: any) => dim.enable_drill_down === true
                );

                if (!isDrillDownEnabled) {
                  // Show all dimensions if drill-down disabled
                  if (chart.extra_config?.dimensions && chart.extra_config.dimensions.length > 0) {
                    return chart.extra_config.dimensions.map((d: any) => d.column).filter(Boolean);
                  }
                  if (
                    chart.extra_config?.dimension_columns &&
                    chart.extra_config.dimension_columns.length > 0
                  ) {
                    return chart.extra_config.dimension_columns;
                  }
                  return [];
                }

                // When drill-down is enabled, only use dimensions with enable_drill_down
                const drillDownDimensions = chart.extra_config.dimensions
                  .filter((dim: any) => dim.enable_drill_down)
                  .map((d: any) => d.column)
                  .filter(Boolean);

                // When drill-down is enabled and active, use only the current level dimension
                if (tableDrillDownState) {
                  const nextIndex = Math.min(
                    tableDrillDownState.currentLevel + 1,
                    drillDownDimensions.length - 1
                  );
                  return [drillDownDimensions[nextIndex]]; // Only current level
                }

                // Drill-down enabled but not yet started: use top-level dimension only
                return [drillDownDimensions[0]]; // Only first dimension
              })(),
              table_columns: chart.extra_config?.table_columns,
            }),
            customizations: chart.extra_config?.customizations || {},
            // Include metrics for multiple metrics support
            metrics: chart.extra_config?.metrics,
            extra_config: {
              filters: [
                ...(chart.extra_config?.filters || []),
                // Add drill-down filters from tableDrillDownState
                ...(chart.chart_type === 'table' && tableDrillDownState?.appliedFilters
                  ? Object.entries(tableDrillDownState.appliedFilters).map(([column, value]) => ({
                      column,
                      operator: 'equals',
                      value,
                    }))
                  : []),
              ],
              pagination: chart.extra_config?.pagination,
              sort: chart.extra_config?.sort,
              time_grain: chart.extra_config?.time_grain,
              table_columns: chart.extra_config?.table_columns,
            },
          }
        : null,
    [chart, tableDrillDownState]
  );

  // For non-map charts (including tables), use the standard chart data hook
  const {
    data: chartData,
    error: dataError,
    isLoading: dataLoading,
  } = useChartData(chart?.chart_type !== 'map' ? chartDataPayload : null);

  // For table charts, use data preview API with pagination
  const {
    data: tableData,
    error: tableError,
    isLoading: tableLoading,
  } = useChartDataPreview(
    chart?.chart_type === 'table' ? chartDataPayload : null,
    tableChartPage,
    tableChartPageSize
  );

  // Fetch total rows for table chart pagination
  const { data: tableDataTotalRows } = useChartDataPreviewTotalRows(
    chart?.chart_type === 'table' ? chartDataPayload : null
  );

  // Handler for table page size change
  const handleTableChartPageSizeChange = useCallback((newPageSize: number) => {
    setTableChartPageSize(newPageSize);
    setTableChartPage(1); // Reset to first page when page size changes
  }, []);

  // Handle table row click for drill-down
  const handleTableRowClick = useCallback(
    (rowData: Record<string, any>, columnName: string) => {
      if (chart?.chart_type !== 'table') return;

      // Check if drill-down is enabled
      const isDrillDownEnabled = chart.extra_config?.dimensions?.some(
        (dim: any) => dim.enable_drill_down === true
      );

      if (!isDrillDownEnabled) return;

      // Get all dimensions in order (only those with drill-down enabled)
      const allDimensions =
        chart.extra_config?.dimensions
          ?.filter((dim: any) => dim.enable_drill_down)
          .map((d: any) => d.column)
          .filter(Boolean) || [];

      if (allDimensions.length === 0) return;

      // Get the current dimension index
      const currentDimensionIndex = tableDrillDownState ? tableDrillDownState.currentLevel : -1;

      // Determine which dimension column is currently displayed
      const currentDisplayedDimension =
        currentDimensionIndex === -1 ? allDimensions[0] : allDimensions[currentDimensionIndex + 1];

      // Only allow clicking on the currently displayed dimension column
      if (columnName !== currentDisplayedDimension) {
        return;
      }

      // Get the value from the clicked row
      const clickedValue = rowData[columnName];
      if (!clickedValue) return;

      // Update drill-down state
      const newLevel = currentDimensionIndex + 1;
      const newAppliedFilters = {
        ...(tableDrillDownState?.appliedFilters || {}),
        [currentDisplayedDimension]: String(clickedValue),
      };

      // If we've reached the last dimension, don't allow further drill-down
      if (newLevel >= allDimensions.length - 1) {
        return;
      }

      setTableDrillDownState({
        currentLevel: newLevel,
        appliedFilters: newAppliedFilters,
      });

      // Reset to first page when drilling down
      setTableChartPage(1);
    },
    [chart, tableDrillDownState]
  );

  // Handle table drill-up (going back)
  const handleTableDrillUp = useCallback(() => {
    if (!tableDrillDownState) return;

    const allDimensions =
      chart?.extra_config?.dimensions
        ?.filter((dim: any) => dim.enable_drill_down)
        .map((d: any) => d.column)
        .filter(Boolean) || [];

    const newLevel = tableDrillDownState.currentLevel - 1;

    if (newLevel < 0) {
      // Reset to top level
      setTableDrillDownState(null);
    } else {
      // Go back one level
      const newAppliedFilters: Record<string, string> = {};
      for (let i = 0; i <= newLevel; i++) {
        const dimColumn = allDimensions[i];
        if (tableDrillDownState.appliedFilters[dimColumn]) {
          newAppliedFilters[dimColumn] = tableDrillDownState.appliedFilters[dimColumn];
        }
      }

      setTableDrillDownState({
        currentLevel: newLevel,
        appliedFilters: newAppliedFilters,
      });
    }

    // Reset to first page when drilling up
    setTableChartPage(1);
  }, [tableDrillDownState, chart]);

  // Determine current level for drill-down
  const currentLevel = drillDownPath.length;
  const currentLayer =
    chart?.chart_type === 'map' && chart?.extra_config?.layers
      ? chart.extra_config.layers[currentLevel]
      : null;

  // Get the current drill-down region ID for dynamic geojson fetching
  const currentDrillDownRegionId =
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null;

  // Fetch geojsons for the current drill-down region (e.g., Karnataka districts)
  const { data: regionGeojsons } = useRegionGeoJSONs(currentDrillDownRegionId);

  // For map charts, determine which geojson and data to fetch based on drill-down state
  let activeGeojsonId = null;
  let activeGeographicColumn = null;

  if (chart?.chart_type === 'map') {
    if (drillDownPath.length > 0) {
      // We're in a drill-down state, use the first available geojson for this region
      const lastDrillDown = drillDownPath[drillDownPath.length - 1];
      activeGeographicColumn = lastDrillDown.geographic_column;

      if (regionGeojsons && regionGeojsons.length > 0) {
        // Use the first available geojson for this region (e.g., Karnataka districts)
        activeGeojsonId = regionGeojsons[0].id;
        console.log(`🗺️ Using geojson ID ${activeGeojsonId} for region ${lastDrillDown.name}`);
      } else {
        // Fallback to the stored geojson_id (if any)
        activeGeojsonId = lastDrillDown.geojson_id;
      }
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
            description: hasPermission('can_edit_charts')
              ? "Click 'Edit Chart' to set up geographic layers"
              : 'Chart needs geographic layers to show filtered regions',
            duration: 7000,
            position: 'top-right',
            ...(hasPermission('can_edit_charts') && {
              action: {
                label: 'Edit Chart',
                onClick: () => (window.location.href = `/charts/${chartId}/edit`),
              },
            }),
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
    if (chart.chart_type !== 'map') return;

    // Check for dynamic drill-down configuration (new system)
    const hasDynamicDrillDown =
      chart?.extra_config?.geographic_hierarchy?.drill_down_levels?.length > 0;

    // NEW DYNAMIC SYSTEM: Use geographic hierarchy
    if (hasDynamicDrillDown) {
      const hierarchy = chart.extra_config.geographic_hierarchy;
      const nextLevel = hierarchy.drill_down_levels.find(
        (level: any) => level.level === currentLevel + 1
      );

      if (nextLevel) {
        // Find the clicked region in the regions data
        const selectedRegion = regions?.find(
          (region: any) => region.name === regionName || region.display_name === regionName
        );

        if (!selectedRegion) {
          toast.error(`Region "${regionName}" not found in database`);
          return;
        }

        toast.success(`🗺️ Drilling down to ${nextLevel.label.toLowerCase()} in ${regionName}`);

        // Create drill-down level for dynamic system
        const newLevel: DrillDownLevel = {
          level: currentLevel + 1,
          name: regionName,
          geographic_column: nextLevel.column,
          geojson_id: 0, // Will be resolved dynamically
          region_id: selectedRegion.id,
          parent_selections: [
            ...drillDownPath.flatMap((level) => level.parent_selections),
            {
              column: activeGeographicColumn || '',
              value: regionName,
            },
          ],
        };

        setDrillDownPath([...drillDownPath, newLevel]);
        return;
      } else {
        // No more levels available in dynamic system
        toast.info('No further drill-down levels configured');
        return;
      }
    }

    // Check for legacy simplified drill-down configuration
    const hasSimplifiedDrillDown =
      chart?.extra_config?.district_column ||
      chart?.extra_config?.ward_column ||
      chart?.extra_config?.subward_column;

    if (hasSimplifiedDrillDown) {
      let nextGeographicColumn = null;
      let levelName = '';

      // Determine next level based on current drill-down state
      if (currentLevel === 0 && chart.extra_config.district_column) {
        nextGeographicColumn = chart.extra_config.district_column;
        levelName = 'districts';
      } else if (currentLevel === 1 && chart.extra_config.ward_column) {
        nextGeographicColumn = chart.extra_config.ward_column;
        levelName = 'wards';
      } else if (currentLevel === 2 && chart.extra_config.subward_column) {
        nextGeographicColumn = chart.extra_config.subward_column;
        levelName = 'sub-wards';
      }

      if (nextGeographicColumn) {
        toast.success(`🗺️ Drilling down to ${levelName} in ${regionName}`);

        // Create drill-down level for simplified system
        // Find the region ID for the clicked region (e.g., Karnataka)
        const selectedRegion = regions?.find(
          (region: any) => region.name === regionName || region.display_name === regionName
        );

        if (!selectedRegion) {
          toast.error(`Region "${regionName}" not found in database`);
          return;
        }

        // For now, we'll create the drill-down level and let the useRegionGeoJSONs
        // hook handle fetching the correct geojson in the data fetching logic
        const regionId = selectedRegion.id;
        console.log(`🔍 Found region "${regionName}" with ID: ${regionId}`);

        const newLevel: DrillDownLevel = {
          level: currentLevel + 1,
          name: regionName,
          geographic_column: nextGeographicColumn,
          geojson_id: 0, // Will be resolved dynamically
          region_id: regionId, // Store the region ID for geojson lookup
          parent_selections: [
            ...drillDownPath.flatMap((level) => level.parent_selections),
            {
              column: activeGeographicColumn || '',
              value: regionName,
            },
          ],
        };

        setDrillDownPath([...drillDownPath, newLevel]);
        return;
      } else {
        // No more levels available in simplified system
        toast.info('No further drill-down levels configured');
        return;
      }
    }

    // Fallback to legacy layers system
    if (!chart?.extra_config?.layers) {
      toast.info('🗺️ No further drill-down levels configured', {
        description: hasPermission('can_edit_charts')
          ? 'Configure additional layers in edit mode to enable deeper drill-down'
          : 'This chart needs additional layers configured for deeper drill-down',
        position: 'top-right',
      });
      return;
    }

    const nextLevel = currentLevel + 1;
    const nextLayer = chart.extra_config.layers[nextLevel];

    if (!nextLayer) {
      // No next layer configured
      toast.info('🗺️ No further drill-down levels configured', {
        description: hasPermission('can_edit_charts')
          ? 'Configure additional layers in edit mode to enable deeper drill-down'
          : 'This chart needs additional layers configured for deeper drill-down',
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
          description: hasPermission('can_edit_charts')
            ? 'Configure this region in edit mode to enable drill-down'
            : 'This region is not configured for drill-down',
          position: 'top-right',
          duration: 4000,
          ...(hasPermission('can_edit_charts') && {
            action: {
              label: 'Edit Chart',
              onClick: () => (window.location.href = `/charts/${chartId}/edit`),
            },
          }),
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
          Chart isn't ready yet. Please check your settings or try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white border-b px-6 py-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isFromDashboard ? (
              <Button
                data-testid="chart-detail-back-dashboard"
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            ) : (
              <Link href="/charts" data-testid="chart-detail-back-link">
                <Button data-testid="chart-detail-back-button" variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
            )}
            <h1 className="text-lg font-semibold">{chart.title}</h1>
          </div>
          <div className="flex gap-2">
            {hasPermission('can_edit_charts') && (
              <Link
                data-testid="chart-detail-edit-link"
                href={`/charts/${chartId}/edit${isFromDashboard ? '?from=dashboard' : ''}`}
              >
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Chart
                </Button>
              </Link>
            )}
            <ChartExportDropdown
              chartTitle={chart.title}
              chartElement={chartElement}
              chartInstance={chartInstance}
              chartType={chart.chart_type}
              chartDataPayload={chartDataPayload}
              tableData={
                chart.chart_type === 'table' && tableData
                  ? {
                      data: tableData.data || [],
                      columns: tableData.columns || [],
                    }
                  : undefined
              }
              tableElement={chart.chart_type === 'table' ? chartContentRef.current : undefined}
            />
          </div>
        </div>
      </div>

      <div>
        {/* Chart Preview - Full width */}
        <div>
          <Card className="h-[75vh]">
            <CardContent className="h-full p-6" ref={chartContentRef}>
              {chart?.chart_type === 'map' ? (
                <MapPreview
                  geojsonData={geojsonData?.geojson_data}
                  geojsonLoading={geojsonLoading}
                  geojsonError={geojsonError}
                  mapData={mapDataOverlay?.data}
                  mapDataLoading={mapDataLoading}
                  mapDataError={mapDataError}
                  valueColumn={
                    chart.extra_config?.metrics?.[0]?.alias || chart.extra_config?.aggregate_column
                  }
                  customizations={chart.extra_config?.customizations || {}}
                  onRegionClick={handleRegionClick}
                  drillDownPath={drillDownPath}
                  onDrillUp={handleDrillUp}
                  onDrillHome={handleDrillHome}
                />
              ) : chart?.chart_type === 'table' ? (
                <div className="w-full h-full flex flex-col">
                  {/* Breadcrumb navigation for drill-down */}
                  {tableDrillDownState && (
                    <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleTableDrillUp}
                        className="h-8"
                      >
                        ← Back
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {Object.entries(tableDrillDownState.appliedFilters)
                          .map(([col, val]) => `${col}: ${val}`)
                          .join(' → ')}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <TableChart
                      data={Array.isArray(tableData?.data) ? tableData.data : []}
                      config={{
                        table_columns:
                          tableData?.columns || chart.extra_config?.table_columns || [],
                        column_formatting: {},
                        sort: chart.extra_config?.sort || [],
                        pagination: chart.extra_config?.pagination || {
                          enabled: true,
                          page_size: 20,
                        },
                      }}
                      isLoading={tableLoading}
                      error={tableError}
                      pagination={
                        chartDataPayload && tableData
                          ? {
                              page: tableChartPage,
                              pageSize: tableChartPageSize,
                              total: tableDataTotalRows || 0,
                              onPageChange: setTableChartPage,
                              onPageSizeChange: handleTableChartPageSizeChange,
                            }
                          : undefined
                      }
                      onRowClick={handleTableRowClick}
                      drillDownEnabled={chart.extra_config?.dimensions?.some(
                        (dim: any) => dim.enable_drill_down === true
                      )}
                      currentDimensionColumn={
                        tableDrillDownState
                          ? chart.extra_config?.dimensions
                              ?.filter((dim: any) => dim.enable_drill_down)
                              .map((d: any) => d.column)
                              .filter(Boolean)[tableDrillDownState.currentLevel + 1]
                          : chart.extra_config?.dimensions
                              ?.filter((dim: any) => dim.enable_drill_down)
                              .map((d: any) => d.column)
                              .filter(Boolean)[0]
                      }
                    />
                  </div>
                </div>
              ) : (
                <ChartPreview
                  config={chartData?.echarts_config}
                  isLoading={dataLoading}
                  error={dataError}
                  onChartReady={setChartInstance}
                  customizations={chart?.extra_config?.customizations}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
