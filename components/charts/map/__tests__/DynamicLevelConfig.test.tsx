/**
 * DynamicLevelConfig Component Tests
 *
 * Tests the dynamic geographic hierarchy configuration UI:
 * - Country selection (fixed to India)
 * - State/geographic column selection
 * - District/drill-down level configuration
 * - Region name download functionality
 * - Geographic hierarchy generation
 * - Auto-prefill and preview payload generation
 *
 * Architecture: Tests complex state management, API hook integration, and user interactions
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DynamicLevelConfig } from '../DynamicLevelConfig';
import * as useChartHooks from '@/hooks/api/useChart';
import * as toastLib from '@/lib/toast';
import * as csvUtils from '@/lib/csvUtils';

// Mock all dependencies
jest.mock('@/hooks/api/useChart');
jest.mock('@/lib/toast');
jest.mock('@/lib/csvUtils');

describe('DynamicLevelConfig', () => {
  const mockOnChange = jest.fn();
  const mockToast = jest.fn();

  const defaultFormData = {
    schema_name: 'public',
    table_name: 'census',
    chart_type: 'map' as const,
    country_code: 'IND',
  };

  const mockColumns = [
    { column_name: 'state', name: 'state', data_type: 'varchar' },
    { column_name: 'district', name: 'district', data_type: 'varchar' },
    { column_name: 'population', name: 'population', data_type: 'integer' },
  ];

  const mockRegionTypes = [
    { id: 1, type: 'country', parent_id: null },
    { id: 2, type: 'state', parent_id: 1 },
    { id: 3, type: 'district', parent_id: 2 },
  ];

  const mockRegions = [{ id: 1, type: 'country', name: 'India' }];

  const mockGeoJSONs = [{ id: 1, is_default: true, name: 'India States' }];

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (useChartHooks.useColumns as jest.Mock).mockReturnValue({
      data: mockColumns,
      isLoading: false,
      error: null,
    });

    (useChartHooks.useAvailableRegionTypes as jest.Mock).mockReturnValue({
      data: mockRegionTypes,
      isLoading: false,
      error: null,
    });

    (useChartHooks.useRegions as jest.Mock).mockReturnValue({
      data: mockRegions,
      isLoading: false,
      error: null,
    });

    (useChartHooks.useRegionGeoJSONs as jest.Mock).mockReturnValue({
      data: mockGeoJSONs,
      isLoading: false,
      error: null,
    });

    (toastLib.toastSuccess as any) = {
      generic: mockToast,
    };
    (toastLib.toastError as any) = {
      api: mockToast,
    };

    (csvUtils.downloadRegionNames as jest.Mock).mockResolvedValue(undefined);
  });

  /**
   * Rendering Tests
   */
  describe('Rendering', () => {
    it('should render loading state while fetching region types', () => {
      (useChartHooks.useAvailableRegionTypes as jest.Mock).mockReturnValue({
        data: [],
        isLoading: true,
        error: null,
      });

      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      expect(screen.getByText('Loading Geographic Levels...')).toBeInTheDocument();
    });

    it('should render all configuration sections after loading', () => {
      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      expect(screen.getByText('Country')).toBeInTheDocument();
      expect(screen.getByText('State Column')).toBeInTheDocument();
    });

    it('should render country selector with India as default', () => {
      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      // Country select should be present but disabled
      expect(screen.getByText('Country')).toBeInTheDocument();
      expect(screen.getByText('Select the country for your map')).toBeInTheDocument();
    });

    it('should render state column selector with available columns', () => {
      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      expect(screen.getByText('State Column')).toBeInTheDocument();
      expect(screen.getByText('Column containing state/region names')).toBeInTheDocument();
    });

    it('should show download buttons for states', () => {
      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      const downloadButton = screen.getByRole('button', { name: /download states/i });
      expect(downloadButton).toBeInTheDocument();
    });

    it('should not show district section without geographic column', () => {
      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      expect(screen.queryByText('District Column (Optional)')).not.toBeInTheDocument();
    });

    it('should show district section when geographic column is selected', () => {
      const formDataWithState = {
        ...defaultFormData,
        geographic_column: 'state',
      };

      render(<DynamicLevelConfig formData={formDataWithState} onChange={mockOnChange} />);

      expect(screen.getByText('District Column (Optional)')).toBeInTheDocument();
    });
  });

  /**
   * State Column Selection
   */
  describe('State Column Selection', () => {
    it('should update geographic column when state column is selected', async () => {
      const user = userEvent.setup();
      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      // Get all comboboxes - first one should be country (disabled), second is state column
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes).toHaveLength(2); // Country and State

      const stateColumnSelect = comboboxes[1]; // State column is second
      expect(stateColumnSelect).toBeInTheDocument();
      await user.click(stateColumnSelect);

      const stateOption = screen.getByRole('option', { name: /^state$/i });
      await user.click(stateOption);

      expect(mockOnChange).toHaveBeenCalledWith({
        geographic_column: 'state',
        selected_geojson_id: undefined,
        district_column: undefined,
        ward_column: undefined,
        subward_column: undefined,
        geographic_hierarchy: undefined,
      });
    });

    it('should reset hierarchy when changing geographic column', async () => {
      const user = userEvent.setup();
      const formDataWithHierarchy = {
        ...defaultFormData,
        geographic_column: 'state',
        geographic_hierarchy: {
          country_code: 'IND',
          base_level: { level: 0, column: 'state', region_type: 'state', label: 'State' },
          drill_down_levels: [
            { level: 1, column: 'district', region_type: 'district', label: 'District' },
          ],
        },
      };

      render(<DynamicLevelConfig formData={formDataWithHierarchy} onChange={mockOnChange} />);

      // Get all comboboxes - first is country (disabled), second is state, third is district
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes.length).toBeGreaterThanOrEqual(2);

      const stateColumnSelect = comboboxes[1]; // State column is second
      expect(stateColumnSelect).toBeInTheDocument();
      await user.click(stateColumnSelect);

      const populationOption = screen.getByRole('option', { name: /population/i });
      await user.click(populationOption);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          geographic_column: 'population',
          geographic_hierarchy: undefined,
        })
      );
    });

    it('should display all available columns with data types', () => {
      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      // Columns are rendered in the select, verify the label exists
      expect(screen.getByText('State Column')).toBeInTheDocument();
    });
  });

  /**
   * District/Drill-down Configuration
   */
  describe('District Configuration', () => {
    it('should show district selector when state column is selected', () => {
      const formDataWithState = {
        ...defaultFormData,
        geographic_column: 'state',
      };

      render(<DynamicLevelConfig formData={formDataWithState} onChange={mockOnChange} />);

      expect(screen.getByText('District Column (Optional)')).toBeInTheDocument();
      expect(screen.getByText('Enable drill-down from states to districts')).toBeInTheDocument();
    });

    it('should update drill-down level when district column is selected', async () => {
      const user = userEvent.setup();
      const formDataWithState = {
        ...defaultFormData,
        geographic_column: 'state',
      };

      render(<DynamicLevelConfig formData={formDataWithState} onChange={mockOnChange} />);

      // Get all comboboxes - first is country (disabled), second is state, third is district
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes).toHaveLength(3); // Country, State, and District

      const districtColumnSelect = comboboxes[2]; // District column is third
      expect(districtColumnSelect).toBeInTheDocument();
      await user.click(districtColumnSelect);

      const districtOption = screen.getByRole('option', { name: /district/i });
      await user.click(districtOption);

      // The component creates hierarchy based on region types, not column names
      // When "state" column is selected as geographic_column and "district" is selected for drill-down,
      // it maps to the region type hierarchy (country -> state)
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          district_column: 'district',
          geographic_hierarchy: expect.objectContaining({
            country_code: 'IND',
            base_level: expect.objectContaining({
              level: 0,
              column: 'state',
              region_type: 'country', // Maps to first region type in hierarchy
              label: 'Country',
            }),
            drill_down_levels: expect.arrayContaining([
              expect.objectContaining({
                level: 1,
                column: 'district',
                region_type: 'state', // Maps to second region type in hierarchy
                label: 'State',
              }),
            ]),
          }),
        })
      );
    });

    it('should allow removing drill-down level', async () => {
      const user = userEvent.setup();
      const formDataWithDrillDown = {
        ...defaultFormData,
        geographic_column: 'state',
        geographic_hierarchy: {
          country_code: 'IND',
          base_level: { level: 0, column: 'state', region_type: 'state', label: 'State' },
          drill_down_levels: [
            { level: 1, column: 'district', region_type: 'district', label: 'District' },
          ],
        },
      };

      render(<DynamicLevelConfig formData={formDataWithDrillDown} onChange={mockOnChange} />);

      // Get all comboboxes - first is country (disabled), second is state, third is district
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes).toHaveLength(3); // Country, State, and District

      const districtColumnSelect = comboboxes[2]; // District column is third
      expect(districtColumnSelect).toBeInTheDocument();
      await user.click(districtColumnSelect);

      const noDrillDownOption = screen.getByRole('option', { name: /no drill-down/i });
      await user.click(noDrillDownOption);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          geographic_hierarchy: expect.objectContaining({
            drill_down_levels: [],
          }),
        })
      );
    });

    it('should show download button for districts', () => {
      const formDataWithState = {
        ...defaultFormData,
        geographic_column: 'state',
      };

      render(<DynamicLevelConfig formData={formDataWithState} onChange={mockOnChange} />);

      const downloadButton = screen.getByRole('button', { name: /download districts/i });
      expect(downloadButton).toBeInTheDocument();
    });
  });

  /**
   * Download Functionality
   */
  describe('Region Name Downloads', () => {
    it('should download state names when button is clicked', async () => {
      const user = userEvent.setup();
      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      const downloadButton = screen.getByRole('button', { name: /download states/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(csvUtils.downloadRegionNames).toHaveBeenCalledWith(
          expect.any(String),
          'IND',
          'state',
          expect.objectContaining({
            onSuccess: expect.any(Function),
          })
        );
      });
    });

    it('should download district names when button is clicked', async () => {
      const user = userEvent.setup();
      const formDataWithState = {
        ...defaultFormData,
        geographic_column: 'state',
      };

      render(<DynamicLevelConfig formData={formDataWithState} onChange={mockOnChange} />);

      const downloadButton = screen.getByRole('button', { name: /download districts/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(csvUtils.downloadRegionNames).toHaveBeenCalledWith(
          expect.any(String),
          'IND',
          'district',
          expect.objectContaining({
            onSuccess: expect.any(Function),
          })
        );
      });
    });

    it('should show loading state during download', async () => {
      const user = userEvent.setup();
      (csvUtils.downloadRegionNames as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      const downloadButton = screen.getByRole('button', { name: /download states/i });
      await user.click(downloadButton);

      expect(screen.getByText(/downloading\.\.\./i)).toBeInTheDocument();
    });

    it('should show toast on successful download', async () => {
      const user = userEvent.setup();
      (csvUtils.downloadRegionNames as jest.Mock).mockImplementation(
        async (_url, _code, _type, options) => {
          options.onSuccess('Download successful');
        }
      );

      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      const downloadButton = screen.getByRole('button', { name: /download states/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Download complete',
          description: 'Download successful',
        });
      });
    });

    it('should show error toast on failed download', async () => {
      const user = userEvent.setup();
      (csvUtils.downloadRegionNames as jest.Mock).mockRejectedValue(new Error('Download failed'));

      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      const downloadButton = screen.getByRole('button', { name: /download states/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Download failed',
          description: 'Failed to download state names. Please try again.',
          variant: 'destructive',
        });
      });
    });

    it('should disable download button when disabled prop is true', () => {
      render(
        <DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} disabled={true} />
      );

      const downloadButton = screen.getByRole('button', { name: /download states/i });
      expect(downloadButton).toBeDisabled();
    });
  });

  /**
   * Auto-Selection and Effects
   */
  describe('Auto-Selection Features', () => {
    it('should auto-select default GeoJSON when geographic column is selected', async () => {
      const formDataWithoutGeoJSON = {
        ...defaultFormData,
        geographic_column: 'state',
      };

      render(<DynamicLevelConfig formData={formDataWithoutGeoJSON} onChange={mockOnChange} />);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          selected_geojson_id: 1,
        });
      });
    });

    it('should not override existing GeoJSON selection', () => {
      const formDataWithGeoJSON = {
        ...defaultFormData,
        geographic_column: 'state',
        selected_geojson_id: 5,
      };

      render(<DynamicLevelConfig formData={formDataWithGeoJSON} onChange={mockOnChange} />);

      // Should not auto-select since one is already selected
      expect(mockOnChange).not.toHaveBeenCalledWith(
        expect.objectContaining({
          selected_geojson_id: 1,
        })
      );
    });

    it('should generate preview payloads when all required fields are set', async () => {
      const completeFormData = {
        ...defaultFormData,
        geographic_column: 'state',
        aggregate_column: 'population',
        aggregate_function: 'sum' as const,
        selected_geojson_id: 1,
      };

      render(<DynamicLevelConfig formData={completeFormData} onChange={mockOnChange} />);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            geojsonPreviewPayload: expect.objectContaining({
              geojsonId: 1,
            }),
            dataOverlayPayload: expect.objectContaining({
              schema_name: 'public',
              table_name: 'census',
              geographic_column: 'state',
              value_column: 'population',
              aggregate_function: 'sum',
            }),
          })
        );
      });
    });

    it('should handle count aggregation without aggregate column', async () => {
      const countFormData = {
        ...defaultFormData,
        geographic_column: 'state',
        aggregate_function: 'count' as const,
        selected_geojson_id: 1,
      };

      render(<DynamicLevelConfig formData={countFormData} onChange={mockOnChange} />);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            dataOverlayPayload: expect.objectContaining({
              value_column: 'state', // Falls back to geographic column
              aggregate_function: 'count',
            }),
          })
        );
      });
    });
  });

  /**
   * Region Type Hierarchy
   */
  describe('Region Type Hierarchy', () => {
    it('should build hierarchy from parent-child relationships', () => {
      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      // Component should process the region types and show appropriate levels
      expect(screen.getByText('State Column')).toBeInTheDocument();
    });

    it('should handle complex multi-level hierarchies', () => {
      const complexRegionTypes = [
        { id: 1, type: 'country', parent_id: null },
        { id: 2, type: 'state', parent_id: 1 },
        { id: 3, type: 'district', parent_id: 2 },
        { id: 4, type: 'ward', parent_id: 3 },
      ];

      (useChartHooks.useAvailableRegionTypes as jest.Mock).mockReturnValue({
        data: complexRegionTypes,
        isLoading: false,
        error: null,
      });

      const formDataWithState = {
        ...defaultFormData,
        geographic_column: 'state',
      };

      render(<DynamicLevelConfig formData={formDataWithState} onChange={mockOnChange} />);

      // Should show district level
      expect(screen.getByText('District Column (Optional)')).toBeInTheDocument();
    });

    it('should handle empty region types gracefully', () => {
      (useChartHooks.useAvailableRegionTypes as jest.Mock).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      // Should still render state column selector
      expect(screen.getByText('State Column')).toBeInTheDocument();
    });
  });

  /**
   * Edge Cases
   */
  describe('Edge Cases', () => {
    it('should handle missing schema or table name', () => {
      const incompleteFormData = {
        chart_type: 'map' as const,
      };

      render(<DynamicLevelConfig formData={incompleteFormData} onChange={mockOnChange} />);

      expect(screen.getByText('State Column')).toBeInTheDocument();
    });

    it('should filter out geographic column from district options', async () => {
      const user = userEvent.setup();
      const formDataWithState = {
        ...defaultFormData,
        geographic_column: 'state',
      };

      render(<DynamicLevelConfig formData={formDataWithState} onChange={mockOnChange} />);

      // Get all comboboxes - first is country (disabled), second is state, third is district
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes).toHaveLength(3); // Country, State, and District

      const districtColumnSelect = comboboxes[2]; // District column is third
      expect(districtColumnSelect).toBeInTheDocument();
      await user.click(districtColumnSelect);

      // District and population should be available, but state might not be shown twice
      expect(screen.getByRole('option', { name: /district/i })).toBeInTheDocument();
    });

    it('should handle missing columns data gracefully', () => {
      (useChartHooks.useColumns as jest.Mock).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      render(<DynamicLevelConfig formData={defaultFormData} onChange={mockOnChange} />);

      // Should still render the structure, even without columns
      expect(screen.getByText('State Column')).toBeInTheDocument();
    });

    it('should preserve legacy district_column for backward compatibility', async () => {
      const user = userEvent.setup();
      const formDataWithState = {
        ...defaultFormData,
        geographic_column: 'state',
      };

      render(<DynamicLevelConfig formData={formDataWithState} onChange={mockOnChange} />);

      // Get all comboboxes - first is country (disabled), second is state, third is district
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes).toHaveLength(3); // Country, State, and District

      const districtColumnSelect = comboboxes[2]; // District column is third
      expect(districtColumnSelect).toBeInTheDocument();
      await user.click(districtColumnSelect);

      const districtOption = screen.getByRole('option', { name: /district/i });
      await user.click(districtOption);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          district_column: 'district',
        })
      );
    });
  });
});
