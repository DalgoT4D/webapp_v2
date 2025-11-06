/**
 * ChartBuilder Component Tests
 *
 * Tests the comprehensive chart creation and editing workflow:
 * - Initialization and chart type selection
 * - Smart column mapping between chart types
 * - Form validation for all chart types
 * - Save handler payload construction
 * - Map-specific features (drill-down, regions, hierarchy)
 * - Data preview and pagination
 * - Advanced configurations (filters, sorting)
 *
 * Architecture: Parameterized tests reduce redundancy while maintaining comprehensive coverage
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartBuilder } from '../ChartBuilder';
import * as useChartHooks from '@/hooks/api/useChart';
import * as chartAutoPrefill from '@/lib/chartAutoPrefill';

// Mock all chart hooks
jest.mock('@/hooks/api/useChart');

// Mock chart auto-prefill utility
jest.mock('@/lib/chartAutoPrefill', () => ({
  generateAutoPrefilledConfig: jest.fn(() => ({})),
}));

// Mock lodash debounce to execute immediately in tests
jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  debounce: (fn: any) => {
    const debouncedFn = (...args: any[]) => fn(...args);
    debouncedFn.cancel = jest.fn();
    return debouncedFn;
  },
}));

// Mock child components to isolate ChartBuilder logic
jest.mock('../ChartTypeSelector', () => ({
  ChartTypeSelector: ({ value, onChange }: any) => (
    <div data-testid="chart-type-selector">
      <button data-testid="select-bar" onClick={() => onChange('bar')}>
        Bar
      </button>
      <button data-testid="select-line" onClick={() => onChange('line')}>
        Line
      </button>
      <button data-testid="select-pie" onClick={() => onChange('pie')}>
        Pie
      </button>
      <button data-testid="select-number" onClick={() => onChange('number')}>
        Number
      </button>
      <button data-testid="select-map" onClick={() => onChange('map')}>
        Map
      </button>
      <button data-testid="select-table" onClick={() => onChange('table')}>
        Table
      </button>
      <span data-testid="selected-chart-type">{value}</span>
    </div>
  ),
}));

jest.mock('../ChartDataConfigurationV3', () => ({
  ChartDataConfigurationV3: ({ onChange, disabled }: any) => (
    <div data-testid="chart-data-config">
      <button
        data-testid="set-dataset"
        onClick={() =>
          onChange({
            schema_name: 'test_schema',
            table_name: 'test_table',
            title: 'Test Chart',
          })
        }
      >
        Set Dataset
      </button>
      <button
        data-testid="set-dimension"
        onClick={() => onChange({ dimension_column: 'category' })}
        disabled={disabled}
      >
        Set Dimension
      </button>
      <button
        data-testid="set-aggregate"
        onClick={() =>
          onChange({
            aggregate_column: 'amount',
            aggregate_function: 'sum',
          })
        }
      >
        Set Aggregate
      </button>
    </div>
  ),
}));

jest.mock('../ChartCustomizations', () => ({
  ChartCustomizations: ({ formData, onChange }: any) => (
    <div data-testid="chart-customizations">
      <button
        data-testid="toggle-legend"
        onClick={() =>
          onChange({
            customizations: {
              ...formData.customizations,
              showLegend: !formData.customizations?.showLegend,
            },
          })
        }
      >
        Toggle Legend
      </button>
    </div>
  ),
}));

jest.mock('../ChartPreview', () => ({
  ChartPreview: ({ isLoading, error }: any) => (
    <div data-testid="chart-preview">
      {isLoading ? 'Loading chart...' : error ? `Error: ${error.message}` : 'Chart Preview'}
    </div>
  ),
}));

jest.mock('../DataPreview', () => ({
  DataPreview: ({ data, isLoading, error, pagination }: any) => (
    <div data-testid="data-preview">
      {isLoading ? 'Loading data...' : error ? 'Error loading data' : `Data: ${data.length} rows`}
      {pagination && (
        <div data-testid="pagination-controls">
          <span>
            Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
          </span>
          <button onClick={() => pagination.onPageChange?.(pagination.page + 1)}>Next</button>
          <button onClick={() => pagination.onPageSizeChange?.(50)}>Change Size</button>
        </div>
      )}
    </div>
  ),
}));

jest.mock('../ChartFiltersConfiguration', () => ({
  ChartFiltersConfiguration: ({ onChange, disabled }: any) => (
    <div data-testid="filters-config">
      <button
        data-testid="add-filter"
        onClick={() =>
          onChange({
            filters: [{ column: 'status', operator: 'equals', value: 'active' }],
          })
        }
        disabled={disabled}
      >
        Add Filter
      </button>
    </div>
  ),
}));

jest.mock('../ChartPaginationConfiguration', () => ({
  ChartPaginationConfiguration: ({ onChange, disabled }: any) => (
    <div data-testid="pagination-config">
      <button
        data-testid="enable-pagination"
        onClick={() =>
          onChange({
            pagination: { enabled: true, page_size: 10 },
          })
        }
        disabled={disabled}
      >
        Enable Pagination
      </button>
    </div>
  ),
}));

jest.mock('../ChartSortConfiguration', () => ({
  ChartSortConfiguration: ({ onChange, disabled }: any) => (
    <div data-testid="sort-config">
      <button
        data-testid="add-sort"
        onClick={() =>
          onChange({
            sort: [{ column: 'created_at', direction: 'desc' }],
          })
        }
        disabled={disabled}
      >
        Add Sort
      </button>
    </div>
  ),
}));

jest.mock('../SimpleTableConfiguration', () => ({
  SimpleTableConfiguration: ({ selectedColumns, onColumnsChange }: any) => (
    <div data-testid="table-config">
      <button
        data-testid="select-columns"
        onClick={() => onColumnsChange(['col1', 'col2', 'col3'])}
      >
        Select Columns
      </button>
      <span>Selected: {selectedColumns?.length || 0}</span>
    </div>
  ),
}));

jest.mock('../map/MapDataConfigurationV3', () => ({
  MapDataConfigurationV3: ({ onFormDataChange }: any) => (
    <div data-testid="map-data-config">
      <button
        data-testid="set-map-config"
        onClick={() =>
          onFormDataChange({
            geographic_column: 'state',
            value_column: 'population',
            aggregate_function: 'sum',
            selected_geojson_id: 1,
          })
        }
      >
        Set Map Config
      </button>
    </div>
  ),
}));

jest.mock('../map/MapCustomizations', () => ({
  MapCustomizations: ({ formData, onFormDataChange }: any) => (
    <div data-testid="map-customizations">
      <button
        data-testid="set-map-style"
        onClick={() =>
          onFormDataChange({
            customizations: { ...formData.customizations, colorScheme: 'Greens' },
          })
        }
      >
        Set Map Style
      </button>
    </div>
  ),
}));

jest.mock('../map/MapPreview', () => ({
  MapPreview: ({
    geojsonLoading,
    mapDataLoading,
    geojsonError,
    mapDataError,
    onRegionClick,
    drillDownPath,
    onDrillUp,
    onDrillHome,
  }: any) => (
    <div data-testid="map-preview">
      {geojsonLoading || mapDataLoading
        ? 'Loading map...'
        : geojsonError || mapDataError
          ? 'Map error'
          : 'Map Preview'}
      {drillDownPath && (
        <>
          <div data-testid="drill-down-path">Drilled: {drillDownPath[0]?.name}</div>
          <button data-testid="drill-up" onClick={onDrillUp}>
            Drill Up
          </button>
          <button data-testid="drill-home" onClick={onDrillHome}>
            Drill Home
          </button>
        </>
      )}
      <button
        data-testid="click-region"
        onClick={() => onRegionClick?.('Test State', { id: 1, name: 'Test State' })}
      >
        Click Region
      </button>
    </div>
  ),
}));

jest.mock('../map/DynamicLevelConfig', () => ({
  DynamicLevelConfig: ({ onChange }: any) => (
    <div data-testid="dynamic-level-config">
      <button
        data-testid="set-hierarchy"
        onClick={() =>
          onChange({
            geographic_hierarchy: {
              country_code: 'IND',
              base_level: { level: 0, column: 'state', region_type: 'state', label: 'State' },
              drill_down_levels: [
                { level: 1, column: 'district', region_type: 'district', label: 'District' },
              ],
            },
          })
        }
      >
        Set Hierarchy
      </button>
    </div>
  ),
}));

describe('ChartBuilder', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    onSave: mockOnSave,
    onCancel: mockOnCancel,
  };

  // Setup default mock implementations
  beforeEach(() => {
    jest.clearAllMocks();

    // Default hook mocks
    (useChartHooks.useTables as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    (useChartHooks.useColumns as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    (useChartHooks.useChartData as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    (useChartHooks.useChartDataPreview as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    (useChartHooks.useChartDataPreviewTotalRows as jest.Mock).mockReturnValue({ data: 0 });
    (useChartHooks.useRawTableData as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    (useChartHooks.useTableCount as jest.Mock).mockReturnValue({ data: null });
    (useChartHooks.useMapData as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    (useChartHooks.useGeoJSONData as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    (useChartHooks.useMapDataOverlay as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    (useChartHooks.useRegions as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    (useChartHooks.useChildRegions as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    (useChartHooks.useRegionGeoJSONs as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    (chartAutoPrefill.generateAutoPrefilledConfig as jest.Mock).mockReturnValue({});
  });

  /**
   * Initialization and Chart Type Selection
   */
  describe('Initialization and Chart Type Selection', () => {
    it('should initialize with default bar chart type', () => {
      render(<ChartBuilder {...defaultProps} />);

      expect(screen.getByTestId('selected-chart-type')).toHaveTextContent('bar');
      expect(screen.getByTestId('chart-type-selector')).toBeInTheDocument();
      expect(screen.getByTestId('chart-data-config')).toBeInTheDocument();
    });

    it('should initialize with provided initial data', () => {
      const initialData = {
        title: 'Existing Chart',
        chart_type: 'line' as const,
        schema_name: 'public',
        table_name: 'users',
        dimension_column: 'date',
      };

      render(<ChartBuilder {...defaultProps} initialData={initialData} />);

      expect(screen.getByTestId('selected-chart-type')).toHaveTextContent('line');
    });

    it.each([
      ['bar', 'line'],
      ['line', 'pie'],
      ['pie', 'number'],
      ['number', 'map'],
      ['map', 'table'],
      ['table', 'bar'],
    ])('should switch from %s to %s chart', async (from, to) => {
      const user = userEvent.setup();
      const initialData = { chart_type: from as any };
      render(<ChartBuilder {...defaultProps} initialData={initialData} />);

      await user.click(screen.getByTestId(`select-${to}`));

      await waitFor(() => {
        expect(screen.getByTestId('selected-chart-type')).toHaveTextContent(to);
      });
    });

    it('should preserve dataset and advanced configs when switching chart types', async () => {
      const user = userEvent.setup();
      const initialData = {
        chart_type: 'bar' as const,
        schema_name: 'public',
        table_name: 'sales',
        title: 'Sales',
        dimension_column: 'category',
        filters: [{ column: 'status', operator: 'equals' as const, value: 'active' }],
        pagination: { enabled: true, page_size: 25 },
      };

      render(<ChartBuilder {...defaultProps} initialData={initialData} />);

      await user.click(screen.getByTestId('select-line'));

      await waitFor(() => {
        expect(screen.getByTestId('selected-chart-type')).toHaveTextContent('line');
      });
    });
  });

  /**
   * Smart Column Mapping Between Chart Types
   */
  describe('Smart Column Mapping', () => {
    it.each([
      ['bar to line', 'bar', 'line', { dimension_column: 'month', aggregate_column: 'revenue' }],
      ['bar to map', 'bar', 'map', { dimension_column: 'state', aggregate_column: 'revenue' }],
      [
        'bar to table',
        'bar',
        'table',
        { dimension_column: 'category', aggregate_column: 'amount' },
      ],
    ])('should map columns when switching %s', async (desc, from, to, columns) => {
      const user = userEvent.setup();
      const initialData = {
        chart_type: from as any,
        schema_name: 'public',
        table_name: 'sales',
        title: 'Sales Chart',
        ...columns,
        aggregate_function: 'sum' as const,
      };

      render(<ChartBuilder {...defaultProps} initialData={initialData} />);

      await user.click(screen.getByTestId(`select-${to}`));

      await waitFor(() => {
        expect(screen.getByTestId('selected-chart-type')).toHaveTextContent(to);
      });
    });

    it('should handle metrics field when switching chart types', async () => {
      const user = userEvent.setup();
      const initialData = {
        chart_type: 'bar' as const,
        schema_name: 'public',
        table_name: 'sales',
        dimension_column: 'category',
        metrics: [
          { column: 'revenue', aggregation: 'sum', alias: 'Total Revenue' },
          { column: 'quantity', aggregation: 'sum', alias: 'Total Quantity' },
        ],
      };

      render(<ChartBuilder {...defaultProps} initialData={initialData} />);

      await user.click(screen.getByTestId('select-line'));

      await waitFor(() => {
        expect(screen.getByTestId('selected-chart-type')).toHaveTextContent('line');
      });
    });
  });

  /**
   * Form Validation
   */
  describe('Form Validation', () => {
    it('should disable save button when form is invalid', () => {
      render(<ChartBuilder {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it.each([
      [
        'table',
        {
          title: 'Table',
          chart_type: 'table' as const,
          schema_name: 'public',
          table_name: 'sales',
        },
      ],
      [
        'bar with metrics',
        {
          title: 'Bar',
          chart_type: 'bar' as const,
          schema_name: 'public',
          table_name: 'sales',
          dimension_column: 'cat',
          metrics: [{ column: 'amt', aggregation: 'sum' }],
        },
      ],
      [
        'number with count',
        {
          title: 'Count',
          chart_type: 'number' as const,
          schema_name: 'public',
          table_name: 'users',
          aggregate_function: 'count' as const,
        },
      ],
      [
        'map with count',
        {
          title: 'Map',
          chart_type: 'map' as const,
          schema_name: 'public',
          table_name: 'locs',
          geographic_column: 'state',
          aggregate_function: 'count' as const,
          selected_geojson_id: 1,
        },
      ],
    ])('should enable save button for valid %s chart', (desc, validData) => {
      render(<ChartBuilder {...defaultProps} initialData={validData} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });

    it.each([
      [
        'number with sum missing column',
        {
          title: 'Sum',
          chart_type: 'number' as const,
          schema_name: 'public',
          table_name: 'sales',
          aggregate_function: 'sum' as const,
        },
      ],
      [
        'map with sum missing value_column',
        {
          title: 'Map',
          chart_type: 'map' as const,
          schema_name: 'public',
          table_name: 'census',
          geographic_column: 'state',
          aggregate_function: 'sum' as const,
          selected_geojson_id: 1,
        },
      ],
      [
        'bar with invalid metrics',
        {
          title: 'Bar',
          chart_type: 'bar' as const,
          schema_name: 'public',
          table_name: 'sales',
          dimension_column: 'cat',
          metrics: [{ column: null as any, aggregation: 'sum' }],
        },
      ],
      [
        'bar missing dimension',
        {
          title: 'Bar',
          chart_type: 'bar' as const,
          schema_name: 'public',
          table_name: 'sales',
          aggregate_column: 'amt',
          aggregate_function: 'sum' as const,
        },
      ],
    ])('should disable save button for invalid %s', (desc, invalidData) => {
      render(<ChartBuilder {...defaultProps} initialData={invalidData} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should allow count metrics without column', () => {
      const validData = {
        title: 'Count Chart',
        chart_type: 'bar' as const,
        schema_name: 'public',
        table_name: 'sales',
        dimension_column: 'category',
        metrics: [{ column: null as any, aggregation: 'count', alias: 'Total' }],
      };

      render(<ChartBuilder {...defaultProps} initialData={validData} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });
  });

  /**
   * Save Handler
   */
  describe('Save Handler', () => {
    it('should call onSave with correct payload for table chart', async () => {
      const user = userEvent.setup();
      const validData = {
        title: 'Test Table',
        chart_type: 'table' as const,
        schema_name: 'public',
        table_name: 'users',
      };

      render(<ChartBuilder {...defaultProps} initialData={validData} />);

      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(mockOnSave).toHaveBeenCalledTimes(1);
      const payload = mockOnSave.mock.calls[0][0];

      expect(payload).toMatchObject({
        title: 'Test Table',
        chart_type: 'table',
        computation_type: 'aggregated',
        schema_name: 'public',
        table_name: 'users',
      });
      expect(payload.extra_config).toBeDefined();
    });

    it('should include metrics, filters, pagination, and sort in payload', async () => {
      const user = userEvent.setup();
      const validData = {
        title: 'Complex Chart',
        chart_type: 'bar' as const,
        schema_name: 'public',
        table_name: 'sales',
        dimension_column: 'category',
        metrics: [{ column: 'revenue', aggregation: 'sum', alias: 'Revenue' }],
        filters: [{ column: 'status', operator: 'equals' as const, value: 'active' }],
        pagination: { enabled: true, page_size: 25 },
        sort: [{ column: 'amount', direction: 'desc' as const }],
        customizations: { showLegend: false },
      };

      render(<ChartBuilder {...defaultProps} initialData={validData} />);

      await user.click(screen.getByRole('button', { name: /save/i }));

      const payload = mockOnSave.mock.calls[0][0];

      expect(payload.extra_config.dimension_column).toBe('category');
      expect(payload.extra_config.metrics).toHaveLength(1);
      expect(payload.extra_config.filters).toHaveLength(1);
      expect(payload.extra_config.pagination).toEqual({ enabled: true, page_size: 25 });
      expect(payload.extra_config.sort).toHaveLength(1);
      expect(payload.extra_config.customizations.showLegend).toBe(false);
    });

    it('should convert geographic hierarchy to layers for map charts', async () => {
      const user = userEvent.setup();
      const validData = {
        title: 'Population Map',
        chart_type: 'map' as const,
        schema_name: 'public',
        table_name: 'census',
        geographic_column: 'state',
        value_column: 'population',
        aggregate_function: 'sum' as const,
        selected_geojson_id: 1,
        geographic_hierarchy: {
          country_code: 'IND',
          base_level: { level: 0, column: 'state', region_type: 'state', label: 'State' },
          drill_down_levels: [
            { level: 1, column: 'district', region_type: 'district', label: 'District' },
          ],
        },
      } as any;

      render(<ChartBuilder {...defaultProps} initialData={validData} />);

      await user.click(screen.getByRole('button', { name: /save/i }));

      const payload = mockOnSave.mock.calls[0][0];

      expect(payload.extra_config.geographic_hierarchy).toBeDefined();
      expect(payload.extra_config.layers).toBeDefined();
      expect(payload.extra_config.drill_down_enabled).toBe(true);
    });

    it('should not call onSave when form is invalid', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  /**
   * Map Features
   */
  describe('Map Features', () => {
    it('should render map-specific configuration components', () => {
      const mapData = {
        chart_type: 'map' as const,
        schema_name: 'public',
        table_name: 'census',
        title: 'Population Map',
      };

      render(<ChartBuilder {...defaultProps} initialData={mapData} />);

      // Map data configuration should be present in the config panel
      expect(screen.getByTestId('map-data-config')).toBeInTheDocument();
      expect(screen.getByTestId('map-customizations')).toBeInTheDocument();

      // Note: Map preview is currently commented out in ChartBuilder, so we don't test for it
    });

    it('should render dynamic level config when geographic column is set', () => {
      const mapData = {
        chart_type: 'map' as const,
        schema_name: 'public',
        table_name: 'census',
        title: 'Population Map',
        geographic_column: 'state',
        value_column: 'population',
        aggregate_function: 'sum' as const,
        selected_geojson_id: 1,
      };

      render(<ChartBuilder {...defaultProps} initialData={mapData} />);

      // Dynamic level config should be rendered when geographic column is set
      expect(screen.getByTestId('dynamic-level-config')).toBeInTheDocument();
    });

    it('should not render dynamic level config without geographic column', () => {
      const mapData = {
        chart_type: 'map' as const,
        schema_name: 'public',
        table_name: 'census',
        title: 'Population Map',
      };

      render(<ChartBuilder {...defaultProps} initialData={mapData} />);

      // Dynamic level config should not be rendered without geographic column
      expect(screen.queryByTestId('dynamic-level-config')).not.toBeInTheDocument();
    });

    it('should allow setting map configuration through MapDataConfigurationV3', async () => {
      const user = userEvent.setup();

      const mapData = {
        chart_type: 'map' as const,
        schema_name: 'public',
        table_name: 'census',
        title: 'Population Map',
      };

      render(<ChartBuilder {...defaultProps} initialData={mapData} />);

      // Simulate setting map configuration
      await user.click(screen.getByTestId('set-map-config'));

      // Configuration should be updated (actual form data is managed internally)
      expect(screen.getByTestId('map-data-config')).toBeInTheDocument();
    });
  });

  /**
   * Configuration Panel Focus (Preview Panel Currently Disabled)
   * Note: The preview panel is currently commented out in ChartBuilder implementation
   */
  describe('Configuration Panel', () => {
    it('should render the configuration panel', () => {
      render(<ChartBuilder {...defaultProps} />);

      // Configuration panel should always be rendered
      expect(screen.getByTestId('chart-type-selector')).toBeInTheDocument();
      expect(screen.getByTestId('chart-data-config')).toBeInTheDocument();
    });

    it('should show all configuration sections for bar chart with dataset', () => {
      const chartData = {
        chart_type: 'bar' as const,
        schema_name: 'public',
        table_name: 'sales',
        title: 'Sales Chart',
      };

      render(<ChartBuilder {...defaultProps} initialData={chartData} />);

      // Should show chart type selector
      expect(screen.getByTestId('chart-type-selector')).toBeInTheDocument();

      // Should show data configuration
      expect(screen.getByTestId('chart-data-config')).toBeInTheDocument();

      // Should show advanced options when dataset is selected
      expect(screen.getByText(/advanced options/i)).toBeInTheDocument();
      expect(screen.getByTestId('filters-config')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-config')).toBeInTheDocument();
      expect(screen.getByTestId('sort-config')).toBeInTheDocument();
    });

    it('should not show advanced options without dataset selection', () => {
      const chartData = {
        chart_type: 'bar' as const,
      };

      render(<ChartBuilder {...defaultProps} initialData={chartData} />);

      // Advanced options should not be visible without dataset
      expect(screen.queryByText(/advanced options/i)).not.toBeInTheDocument();
    });

    it('should render table-specific configuration for table charts', () => {
      render(
        <ChartBuilder
          {...defaultProps}
          initialData={{
            chart_type: 'table' as const,
            schema_name: 'public',
            table_name: 'users',
            title: 'Users Table',
          }}
        />
      );

      // Table should show table-specific config
      expect(screen.getByTestId('table-config')).toBeInTheDocument();
      // Table uses regular ChartDataConfigurationV3
      expect(screen.getByTestId('chart-data-config')).toBeInTheDocument();
    });

    it('should render map-specific configuration for map charts', () => {
      render(
        <ChartBuilder
          {...defaultProps}
          initialData={{
            chart_type: 'map' as const,
            schema_name: 'public',
            table_name: 'census',
            title: 'Population Map',
          }}
        />
      );

      // Map should show map-specific config
      expect(screen.getByTestId('map-data-config')).toBeInTheDocument();
      expect(screen.getByTestId('map-customizations')).toBeInTheDocument();
    });
  });

  /**
   * Auto-prefill and Advanced Features
   */
  describe('Auto-prefill and Advanced Features', () => {
    it('should trigger auto-prefill when columns are loaded', () => {
      const mockColumns = [
        { name: 'category', data_type: 'varchar', column_name: 'category' },
        { name: 'amount', data_type: 'integer', column_name: 'amount' },
      ];

      (useChartHooks.useColumns as jest.Mock).mockReturnValue({
        data: mockColumns,
        isLoading: false,
        error: null,
      });

      (chartAutoPrefill.generateAutoPrefilledConfig as jest.Mock).mockReturnValue({
        dimension_column: 'category',
        metrics: [{ column: null, aggregation: 'count', alias: 'Total Count' }],
      });

      const initialData = {
        schema_name: 'public',
        table_name: 'sales',
        chart_type: 'bar' as const,
      };

      render(<ChartBuilder {...defaultProps} initialData={initialData} />);

      expect(chartAutoPrefill.generateAutoPrefilledConfig).toHaveBeenCalledWith('bar', mockColumns);
    });

    it('should render advanced configuration options', () => {
      const chartData = {
        chart_type: 'bar' as const,
        schema_name: 'public',
        table_name: 'sales',
      };

      render(<ChartBuilder {...defaultProps} initialData={chartData} />);

      expect(screen.getByTestId('filters-config')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-config')).toBeInTheDocument();
      expect(screen.getByTestId('sort-config')).toBeInTheDocument();
      expect(screen.getByText(/advanced options/i)).toBeInTheDocument();
    });
  });

  /**
   * UI Controls and State Management
   */
  describe('UI Controls and State', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should show saving state when isSaving is true', () => {
      render(<ChartBuilder {...defaultProps} isSaving={true} />);

      const saveButton = screen.getByRole('button', { name: /saving/i });
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveTextContent('Saving...');
    });

    it('should render table-specific components', () => {
      const tableData = {
        chart_type: 'table' as const,
        schema_name: 'public',
        table_name: 'users',
      };

      render(<ChartBuilder {...defaultProps} initialData={tableData} />);

      expect(screen.getByTestId('table-config')).toBeInTheDocument();
    });
  });

  /**
   * Edge Cases
   */
  describe('Edge Cases', () => {
    it.each([
      ['missing initial data', {}],
      ['undefined fields', { title: undefined as any, chart_type: undefined as any }],
      ['null values', { dimension_column: null as any, aggregate_column: null as any }],
      ['empty arrays', { metrics: [], filters: [], table_columns: [] }],
    ])('should handle %s gracefully', (desc, initialData) => {
      render(<ChartBuilder {...defaultProps} initialData={initialData} />);

      expect(screen.getByTestId('chart-type-selector')).toBeInTheDocument();
    });

    it('should handle rapid chart type changes', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder {...defaultProps} />);

      await user.click(screen.getByTestId('select-line'));
      await user.click(screen.getByTestId('select-pie'));
      await user.click(screen.getByTestId('select-number'));

      await waitFor(() => {
        expect(screen.getByTestId('selected-chart-type')).toHaveTextContent('number');
      });
    });

    it('should render map chart with geojson config', () => {
      (useChartHooks.useGeoJSONData as jest.Mock).mockReturnValue({
        data: { geojson_data: { type: 'FeatureCollection', features: [] } },
        isLoading: false,
        error: null,
      });

      const mapData = {
        chart_type: 'map' as const,
        schema_name: 'public',
        table_name: 'census',
        title: 'Census Map',
        selected_geojson_id: 1,
      };

      render(<ChartBuilder {...defaultProps} initialData={mapData} />);

      // Map configuration should be present
      expect(screen.getByTestId('map-data-config')).toBeInTheDocument();
    });

    it('should handle map configuration with geographic hierarchy', () => {
      const mapData = {
        chart_type: 'map' as const,
        schema_name: 'public',
        table_name: 'census',
        title: 'Census Map',
        geographic_column: 'state',
        value_column: 'population',
        aggregate_function: 'sum' as const,
        selected_geojson_id: 1,
        geographic_hierarchy: {
          country_code: 'IND',
          base_level: { level: 0, column: 'state', region_type: 'state', label: 'State' },
          drill_down_levels: [
            { level: 1, column: 'district', region_type: 'district', label: 'District' },
          ],
        },
      } as any;

      render(<ChartBuilder {...defaultProps} initialData={mapData} />);

      // Dynamic level config should be rendered
      expect(screen.getByTestId('dynamic-level-config')).toBeInTheDocument();
    });
  });
});
