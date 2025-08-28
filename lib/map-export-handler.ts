import * as echarts from 'echarts';
import { apiGet } from '@/lib/api';

export interface MapExportData {
  geojson: any;
  chartConfig: any;
  mapData?: any[];
}

/**
 * Handles export functionality for map charts by fetching required geojson data
 * and creating a temporary rendered map for export
 */
export class MapExportHandler {
  /**
   * Fetch map data needed for export from chart API
   */
  static async fetchMapExportData(chartId: number): Promise<MapExportData> {
    try {
      // Step 1: Fetch the chart to get its configuration
      const chart = await apiGet(`/api/charts/${chartId}/`);

      if (!chart) {
        throw new Error('Chart not found');
      }

      if (chart.chart_type !== 'map') {
        throw new Error('Chart is not a map type');
      }

      // Step 2: Determine which geojson to fetch
      let activeGeojsonId = null;
      let activeGeographicColumn = null;

      if (chart.extra_config?.layers?.[0]) {
        // Use first layer configuration
        const firstLayer = chart.extra_config.layers[0];
        activeGeojsonId = firstLayer.geojson_id;
        activeGeographicColumn = firstLayer.geographic_column;
      } else {
        // Fallback to legacy configuration
        activeGeojsonId = chart.extra_config?.selected_geojson_id;
        activeGeographicColumn = chart.extra_config?.geographic_column;
      }

      if (!activeGeojsonId) {
        throw new Error('No geojson configuration found for this map chart');
      }

      // Step 3: Fetch the geojson data
      const geojsonResponse = await apiGet(`/api/charts/geojsons/${activeGeojsonId}/`);

      if (!geojsonResponse?.geojson_data) {
        throw new Error('Failed to fetch geojson data');
      }

      // Step 4: Fetch map data overlay if we have the required configuration
      let mapData = [];
      if (activeGeographicColumn && chart.extra_config?.value_column) {
        try {
          const mapDataPayload = {
            schema_name: chart.schema_name,
            table_name: chart.table_name,
            geographic_column: activeGeographicColumn,
            value_column: chart.extra_config.aggregate_column || chart.extra_config.value_column,
            metrics: [
              {
                column: chart.extra_config.aggregate_column || chart.extra_config.value_column,
                aggregation: chart.extra_config.aggregate_function || 'sum',
                alias: 'value',
              },
            ],
            filters: {}, // No drill-down filters for export
            chart_filters: chart.extra_config.filters || [],
          };

          const { apiPost } = await import('@/lib/api');
          const mapDataResponse = await apiPost('/api/charts/map-data-overlay/', mapDataPayload);
          mapData = mapDataResponse?.data || [];
        } catch (dataError) {
          console.warn('Failed to fetch map data overlay, proceeding with empty map:', dataError);
          // Continue with empty map data rather than failing completely
        }
      }

      return {
        geojson: geojsonResponse.geojson_data,
        chartConfig: {}, // Map charts don't use echarts_config from data endpoint
        mapData: mapData,
      };
    } catch (error) {
      console.error('Failed to fetch map export data:', error);
      throw error;
    }
  }

  /**
   * Create a temporary ECharts instance with full map data for export
   */
  static async createMapChartForExport(
    mapExportData: MapExportData,
    title: string
  ): Promise<echarts.ECharts> {
    const { geojson, chartConfig, mapData } = mapExportData;

    // Create a hidden container for the map
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    try {
      // Register the geojson data
      const mapName = `export-map-${Date.now()}`;
      echarts.registerMap(mapName, geojson);

      // Create chart instance
      const chartInstance = echarts.init(container);

      // Prepare series data for the map
      let seriesData: any[] = [];
      if (mapData && mapData.length > 0) {
        seriesData = mapData.map((item) => ({
          name: item.name,
          value: item.value,
        }));
      }

      // Calculate min/max values for visualMap
      const values = seriesData.map((item) => item.value).filter((v) => v != null);
      const minValue = values.length > 0 ? Math.min(...values) : 0;
      const maxValue = values.length > 0 ? Math.max(...values) : 100;

      // Create the complete chart configuration
      const exportConfig = {
        title: {
          text: title,
          left: 'center',
          textStyle: {
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
        tooltip: {
          trigger: 'item',
          formatter: function (params: any) {
            if (params.data && params.data.value != null) {
              return `${params.name}<br/>Value: ${params.data.value}`;
            }
            return `${params.name}<br/>No data`;
          },
        },
        visualMap:
          seriesData.length > 0
            ? {
                min: minValue,
                max: maxValue,
                left: 'left',
                top: 'bottom',
                text: ['High', 'Low'],
                calculable: true,
                color: ['#1f77b4', '#aec7e8', '#ffbb78', '#ff7f0e', '#d62728'],
              }
            : undefined,
        series: [
          {
            name: 'Map Data',
            type: 'map',
            mapType: mapName,
            roam: false, // Disable roaming for export
            emphasis: {
              label: {
                show: true,
              },
            },
            data: seriesData,
          },
        ],
        // Merge any existing chart configuration
        ...chartConfig,
      };

      // Set the chart option and wait for it to render
      chartInstance.setOption(exportConfig);

      // Wait a bit for the chart to fully render
      await new Promise((resolve) => setTimeout(resolve, 500));

      return chartInstance;
    } catch (error) {
      // Clean up container on error
      document.body.removeChild(container);
      throw error;
    }
  }

  /**
   * Clean up temporary chart instance and container
   */
  static cleanupMapChart(chartInstance: echarts.ECharts): void {
    try {
      const container = chartInstance.getDom();
      chartInstance.dispose();
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    } catch (error) {
      console.error('Error cleaning up map chart:', error);
    }
  }

  /**
   * Complete map export workflow - fetch data, create chart, export, cleanup
   */
  static async exportMapChart(
    chartId: number,
    chartTitle: string,
    format: 'png' | 'pdf' = 'png'
  ): Promise<echarts.ECharts> {
    // Fetch map data
    const mapExportData = await this.fetchMapExportData(chartId);

    // Create temporary chart instance
    const chartInstance = await this.createMapChartForExport(mapExportData, chartTitle);

    return chartInstance;
  }
}
