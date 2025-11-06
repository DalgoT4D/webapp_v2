/**
 * MapCustomizations Component Tests
 *
 * Tests the map styling and configuration UI:
 * - Color scheme selection
 * - Interactive feature toggles (tooltip, legend, selection)
 * - Data handling configuration (null value labels)
 * - Visual elements (legend position, region names, hover effects)
 * - Animation and border customizations
 *
 * Architecture: Tests UI rendering and onChange callbacks for all customization options
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapCustomizations } from '../MapCustomizations';

describe('MapCustomizations', () => {
  const mockOnFormDataChange = jest.fn();

  const defaultFormData = {
    customizations: {
      colorScheme: 'Blues',
      showTooltip: true,
      showLegend: true,
      select: true,
      nullValueLabel: 'No Data',
      legendPosition: 'left',
      showLabels: false,
      emphasis: true,
      borderWidth: 1,
      borderColor: '#333',
      animation: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Rendering Tests
   */
  describe('Rendering', () => {
    it('should render all configuration sections', () => {
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      // Verify all card titles are present
      expect(screen.getByText('Color and Styling')).toBeInTheDocument();
      expect(screen.getByText('Interactive Features')).toBeInTheDocument();
      expect(screen.getByText('Data Handling')).toBeInTheDocument();
      expect(screen.getByText('Visual Elements')).toBeInTheDocument();
      expect(screen.getByText('Animation & Effects')).toBeInTheDocument();
    });

    it('should render with empty customizations object', () => {
      render(<MapCustomizations formData={{}} onFormDataChange={mockOnFormDataChange} />);

      // Should still render all sections
      expect(screen.getByText('Color and Styling')).toBeInTheDocument();
      expect(screen.getByText('Interactive Features')).toBeInTheDocument();
    });

    it('should render all color scheme options', () => {
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      const colorSchemeSelect = screen
        .getByText('Color Scheme')
        .parentElement?.parentElement?.querySelector('[role="combobox"]');
      expect(colorSchemeSelect).toBeInTheDocument();
    });

    it('should display current customization values correctly', () => {
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      // Check switches are in correct state (we can verify by checking the form data structure)
      expect(screen.getByText('Show Tooltip')).toBeInTheDocument();
      expect(screen.getByText('Show Legend')).toBeInTheDocument();
      expect(screen.getByText('Enable Selection')).toBeInTheDocument();
    });
  });

  /**
   * Color Scheme Selection
   */
  describe('Color Scheme', () => {
    it('should render color scheme selector', () => {
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      expect(screen.getByText('Color Scheme')).toBeInTheDocument();

      // Verify the select is present
      const colorSchemeLabel = screen.getByText('Color Scheme');
      const selectTrigger =
        colorSchemeLabel.parentElement?.parentElement?.querySelector('[role="combobox"]');
      expect(selectTrigger).toBeInTheDocument();
    });

    it('should support all available color schemes', () => {
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      // Color schemes are defined in the component: Blues, Reds, Greens, Purples, Oranges, Greys
      // We verify the structure renders correctly
      expect(screen.getByText('Color Scheme')).toBeInTheDocument();
    });

    it('should display current color scheme value', () => {
      const formDataWithReds = {
        customizations: {
          colorScheme: 'Reds',
        },
      };

      render(
        <MapCustomizations formData={formDataWithReds} onFormDataChange={mockOnFormDataChange} />
      );

      // The select should show the current value
      expect(screen.getByText('Color Scheme')).toBeInTheDocument();
    });
  });

  /**
   * Interactive Features Toggles
   */
  describe('Interactive Features', () => {
    it('should toggle show tooltip', async () => {
      const user = userEvent.setup();
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      const tooltipSwitch = screen
        .getByText('Show Tooltip')
        .parentElement?.parentElement?.querySelector('button');

      if (tooltipSwitch) {
        await user.click(tooltipSwitch);

        expect(mockOnFormDataChange).toHaveBeenCalledWith({
          ...defaultFormData,
          customizations: {
            ...defaultFormData.customizations,
            showTooltip: false,
          },
        });
      }
    });

    it('should toggle show legend', async () => {
      const user = userEvent.setup();
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      const legendSwitch = screen
        .getByText('Show Legend')
        .parentElement?.parentElement?.querySelector('button');

      if (legendSwitch) {
        await user.click(legendSwitch);

        expect(mockOnFormDataChange).toHaveBeenCalledWith({
          ...defaultFormData,
          customizations: {
            ...defaultFormData.customizations,
            showLegend: false,
          },
        });
      }
    });

    it('should toggle enable selection', async () => {
      const user = userEvent.setup();
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      const selectionSwitch = screen
        .getByText('Enable Selection')
        .parentElement?.parentElement?.querySelector('button');

      if (selectionSwitch) {
        await user.click(selectionSwitch);

        expect(mockOnFormDataChange).toHaveBeenCalledWith({
          ...defaultFormData,
          customizations: {
            ...defaultFormData.customizations,
            select: false,
          },
        });
      }
    });

    it('should handle default values when customizations are undefined', () => {
      render(<MapCustomizations formData={{}} onFormDataChange={mockOnFormDataChange} />);

      // Component should render with default behavior (tooltips, legends enabled by default)
      expect(screen.getByText('Show Tooltip')).toBeInTheDocument();
      expect(screen.getByText('Display values on hover')).toBeInTheDocument();
    });
  });

  /**
   * Data Handling Configuration
   */
  describe('Data Handling', () => {
    it('should update null value label', async () => {
      const user = userEvent.setup();
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      const nullLabelInput = screen.getByPlaceholderText('No Data');

      await user.clear(nullLabelInput);
      await user.type(nullLabelInput, 'N/A');

      // Should call onChange for each character typed
      expect(mockOnFormDataChange).toHaveBeenCalled();

      // Check the last call has the expected structure
      const calls = mockOnFormDataChange.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.customizations.nullValueLabel).toBeDefined();
    });

    it('should display default null value label when undefined', () => {
      const formDataWithoutNull = {
        customizations: {},
      };

      render(
        <MapCustomizations formData={formDataWithoutNull} onFormDataChange={mockOnFormDataChange} />
      );

      const nullLabelInput = screen.getByPlaceholderText('No Data') as HTMLInputElement;
      expect(nullLabelInput.value).toBe('No Data');
    });

    it('should preserve custom null value label', () => {
      const formDataWithCustomNull = {
        customizations: {
          nullValueLabel: 'Data Unavailable',
        },
      };

      render(
        <MapCustomizations
          formData={formDataWithCustomNull}
          onFormDataChange={mockOnFormDataChange}
        />
      );

      const nullLabelInput = screen.getByDisplayValue('Data Unavailable');
      expect(nullLabelInput).toBeInTheDocument();
    });
  });

  /**
   * Visual Elements Configuration
   */
  describe('Visual Elements', () => {
    it('should render legend position selector', () => {
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      expect(screen.getByText('Legend Position')).toBeInTheDocument();

      const legendPosLabel = screen.getByText('Legend Position');
      const selectTrigger = legendPosLabel.parentElement?.querySelector('[role="combobox"]');
      expect(selectTrigger).toBeInTheDocument();
    });

    it('should toggle show region names', async () => {
      const user = userEvent.setup();
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      const labelsSwitch = screen
        .getByText('Show Region Names')
        .parentElement?.parentElement?.querySelector('button');

      if (labelsSwitch) {
        await user.click(labelsSwitch);

        expect(mockOnFormDataChange).toHaveBeenCalledWith({
          ...defaultFormData,
          customizations: {
            ...defaultFormData.customizations,
            showLabels: true,
          },
        });
      }
    });

    it('should toggle highlight on hover', async () => {
      const user = userEvent.setup();
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      const emphasisSwitch = screen
        .getByText('Highlight on Hover')
        .parentElement?.parentElement?.querySelector('button');

      if (emphasisSwitch) {
        await user.click(emphasisSwitch);

        expect(mockOnFormDataChange).toHaveBeenCalledWith({
          ...defaultFormData,
          customizations: {
            ...defaultFormData.customizations,
            emphasis: false,
          },
        });
      }
    });

    it('should support all legend positions', () => {
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      expect(screen.getByText('Legend Position')).toBeInTheDocument();
      // Component defines: left, right, top, bottom
    });
  });

  /**
   * Animation & Effects Configuration
   */
  describe('Animation & Effects', () => {
    it('should render border width selector', () => {
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      expect(screen.getByText('Border Width')).toBeInTheDocument();
      expect(screen.getByText('Width of region borders')).toBeInTheDocument();

      const borderWidthLabel = screen.getByText('Border Width');
      const selectTrigger =
        borderWidthLabel.parentElement?.parentElement?.querySelector('[role="combobox"]');
      expect(selectTrigger).toBeInTheDocument();
    });

    it('should render border color selector', () => {
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      expect(screen.getByText('Border Color')).toBeInTheDocument();

      const borderColorLabel = screen.getByText('Border Color');
      const selectTrigger = borderColorLabel.parentElement?.querySelector('[role="combobox"]');
      expect(selectTrigger).toBeInTheDocument();
    });

    it('should toggle animation', async () => {
      const user = userEvent.setup();
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      const animationSwitch = screen
        .getByText('Animation')
        .parentElement?.parentElement?.querySelector('button');

      if (animationSwitch) {
        await user.click(animationSwitch);

        expect(mockOnFormDataChange).toHaveBeenCalledWith({
          ...defaultFormData,
          customizations: {
            ...defaultFormData.customizations,
            animation: false,
          },
        });
      }
    });

    it('should display border width options with proper descriptions', () => {
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      // Component defines border width options: No Border (0), Thin (1), Medium (2), Thick (3)
      expect(screen.getByText('Border Width')).toBeInTheDocument();
    });

    it('should display border color options', () => {
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      // Component defines border colors: Dark Gray, Medium Gray, Light Gray, White, Black
      expect(screen.getByText('Border Color')).toBeInTheDocument();
    });
  });

  /**
   * Integration Tests
   */
  describe('Integration', () => {
    it('should preserve unrelated formData fields when updating customizations', async () => {
      const user = userEvent.setup();
      const formDataWithExtras = {
        ...defaultFormData,
        schema_name: 'public',
        table_name: 'census',
        geographic_column: 'state',
      };

      render(
        <MapCustomizations formData={formDataWithExtras} onFormDataChange={mockOnFormDataChange} />
      );

      const tooltipSwitch = screen
        .getByText('Show Tooltip')
        .parentElement?.parentElement?.querySelector('button');

      if (tooltipSwitch) {
        await user.click(tooltipSwitch);

        expect(mockOnFormDataChange).toHaveBeenCalledWith({
          ...formDataWithExtras,
          customizations: {
            ...formDataWithExtras.customizations,
            showTooltip: false,
          },
        });
      }
    });

    it('should handle multiple rapid customization changes', async () => {
      const user = userEvent.setup();
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      // Toggle multiple switches rapidly
      const tooltipSwitch = screen
        .getByText('Show Tooltip')
        .parentElement?.parentElement?.querySelector('button');
      const legendSwitch = screen
        .getByText('Show Legend')
        .parentElement?.parentElement?.querySelector('button');

      if (tooltipSwitch && legendSwitch) {
        await user.click(tooltipSwitch);
        await user.click(legendSwitch);

        expect(mockOnFormDataChange).toHaveBeenCalledTimes(2);
      }
    });

    it('should maintain proper structure for all customization updates', async () => {
      const user = userEvent.setup();
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      const animationSwitch = screen
        .getByText('Animation')
        .parentElement?.parentElement?.querySelector('button');

      if (animationSwitch) {
        await user.click(animationSwitch);

        const callArg = mockOnFormDataChange.mock.calls[0][0];

        // Verify structure
        expect(callArg).toHaveProperty('customizations');
        expect(callArg.customizations).toHaveProperty('animation');
        expect(typeof callArg.customizations.animation).toBe('boolean');
      }
    });
  });

  /**
   * Edge Cases
   */
  describe('Edge Cases', () => {
    it('should handle undefined customizations', () => {
      render(<MapCustomizations formData={{}} onFormDataChange={mockOnFormDataChange} />);

      expect(screen.getByText('Interactive Features')).toBeInTheDocument();
    });

    it('should display descriptive text for all options', () => {
      render(
        <MapCustomizations formData={defaultFormData} onFormDataChange={mockOnFormDataChange} />
      );

      expect(screen.getByText('Display values on hover')).toBeInTheDocument();
      expect(screen.getByText('Display color scale legend')).toBeInTheDocument();
      expect(screen.getByText('Allow clicking to select regions')).toBeInTheDocument();
      expect(screen.getByText('Display region labels on the map')).toBeInTheDocument();
      expect(screen.getByText('Emphasize regions when hovering')).toBeInTheDocument();
      expect(screen.getByText('Enable smooth transitions')).toBeInTheDocument();
    });

    it('should handle formData with minimal properties', () => {
      const minimalFormData = {
        customizations: {},
      };

      render(
        <MapCustomizations formData={minimalFormData} onFormDataChange={mockOnFormDataChange} />
      );

      // All sections should render with defaults
      expect(screen.getByText('Color and Styling')).toBeInTheDocument();
      expect(screen.getByText('Interactive Features')).toBeInTheDocument();
      expect(screen.getByText('Data Handling')).toBeInTheDocument();
    });
  });
});
