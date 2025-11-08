/**
 * Tests for ChartTypeSelectorDropdown component
 * Tests dropdown selector for chart types with icons and descriptions
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChartTypeSelectorDropdown } from '../ChartTypeSelectorDropdown';

// Mock pointer capture for Radix UI
beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = jest.fn();
  HTMLElement.prototype.setPointerCapture = jest.fn();
  HTMLElement.prototype.releasePointerCapture = jest.fn();
});

describe('ChartTypeSelectorDropdown', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render and display all chart types with descriptions correctly', () => {
    // Render select trigger with proper attributes
    render(<ChartTypeSelectorDropdown value={undefined} onChange={mockOnChange} />);
    const combobox = screen.getByRole('combobox');
    expect(combobox).toBeInTheDocument();
    expect(combobox).toHaveAttribute('type', 'button');
    expect(combobox).toHaveAttribute('aria-expanded');
    expect(combobox).toHaveAttribute('aria-controls');

    // Display selected chart type name and description
    const { rerender } = render(<ChartTypeSelectorDropdown value="bar" onChange={mockOnChange} />);
    expect(screen.getByText('Bar Chart')).toBeInTheDocument();
    expect(screen.getByText('Compare values across categories')).toBeInTheDocument();

    // No description when nothing selected
    rerender(<ChartTypeSelectorDropdown value={undefined} onChange={mockOnChange} />);
    expect(screen.queryByText('Compare values across categories')).not.toBeInTheDocument();

    // Display all chart types correctly
    const chartTypes = [
      { value: 'bar', name: 'Bar Chart', description: 'Compare values across categories' },
      { value: 'pie', name: 'Pie Chart', description: 'Show proportions of a whole' },
      { value: 'line', name: 'Line Chart', description: 'Display trends over time' },
      { value: 'number', name: 'Number', description: 'Display a single metric or KPI' },
      { value: 'map', name: 'Map', description: 'Visualize geographic data' },
      { value: 'table', name: 'Table', description: 'Display data in rows and columns' },
    ];

    chartTypes.forEach(({ value, name, description }) => {
      const { unmount } = render(
        <ChartTypeSelectorDropdown value={value} onChange={mockOnChange} />
      );
      expect(screen.getByText(name)).toBeInTheDocument();
      expect(screen.getByText(description)).toBeInTheDocument();
      unmount();
    });
  });

  it('should handle value changes and update description with proper styling', () => {
    const { rerender } = render(<ChartTypeSelectorDropdown value="bar" onChange={mockOnChange} />);
    expect(screen.getByText('Bar Chart')).toBeInTheDocument();

    // Change to pie
    rerender(<ChartTypeSelectorDropdown value="pie" onChange={mockOnChange} />);
    expect(screen.getByText('Pie Chart')).toBeInTheDocument();
    expect(screen.getByText('Show proportions of a whole')).toBeInTheDocument();

    // Clear value
    rerender(<ChartTypeSelectorDropdown value={undefined} onChange={mockOnChange} />);
    expect(screen.queryByText('Bar Chart')).not.toBeInTheDocument();

    // Switch between types
    rerender(<ChartTypeSelectorDropdown value="line" onChange={mockOnChange} />);
    expect(screen.getByText('Line Chart')).toBeInTheDocument();

    rerender(<ChartTypeSelectorDropdown value="number" onChange={mockOnChange} />);
    expect(screen.getByText('Number')).toBeInTheDocument();
    expect(screen.queryByText('Line Chart')).not.toBeInTheDocument();

    // Update description and style correctly
    rerender(<ChartTypeSelectorDropdown value="bar" onChange={mockOnChange} />);
    let description = screen.getByText('Compare values across categories');
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass('text-sm', 'text-muted-foreground');

    rerender(<ChartTypeSelectorDropdown value="line" onChange={mockOnChange} />);
    expect(screen.getByText('Display trends over time')).toBeInTheDocument();
    expect(screen.queryByText('Compare values across categories')).not.toBeInTheDocument();

    // Hide description when cleared
    rerender(<ChartTypeSelectorDropdown value={undefined} onChange={mockOnChange} />);
    expect(screen.queryByText('Display trends over time')).not.toBeInTheDocument();

    // Rapid value prop changes
    rerender(<ChartTypeSelectorDropdown value="bar" onChange={mockOnChange} />);
    expect(screen.getByText('Bar Chart')).toBeInTheDocument();
    rerender(<ChartTypeSelectorDropdown value="line" onChange={mockOnChange} />);
    expect(screen.getByText('Line Chart')).toBeInTheDocument();
    rerender(<ChartTypeSelectorDropdown value="pie" onChange={mockOnChange} />);
    expect(screen.getByText('Pie Chart')).toBeInTheDocument();
    rerender(<ChartTypeSelectorDropdown value="number" onChange={mockOnChange} />);
    expect(screen.getByText('Number')).toBeInTheDocument();

    // onChange should not be called during renders
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should meet accessibility requirements, handle edge cases, and have proper layout', () => {
    // Accessibility
    render(<ChartTypeSelectorDropdown value={undefined} onChange={mockOnChange} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-expanded');
    expect(trigger).toHaveAttribute('aria-controls');

    // Should be focusable
    trigger.focus();
    expect(trigger).toHaveFocus();

    // Edge case values
    const { rerender, container } = render(
      <ChartTypeSelectorDropdown value="invalid" onChange={mockOnChange} />
    );
    expect(
      screen.queryByText(/Bar Chart|Pie Chart|Line Chart|Number|Map|Table/)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Compare values/)).not.toBeInTheDocument();

    // Empty string value
    rerender(<ChartTypeSelectorDropdown value="" onChange={mockOnChange} />);
    expect(
      screen.queryByText(/Bar Chart|Pie Chart|Line Chart|Number|Map|Table/)
    ).not.toBeInTheDocument();

    // Null value
    rerender(<ChartTypeSelectorDropdown value={null as any} onChange={mockOnChange} />);
    expect(screen.queryByText(/Bar Chart|Pie Chart/)).not.toBeInTheDocument();

    // Should not call onChange on render
    expect(mockOnChange).not.toHaveBeenCalled();

    // Layout structure
    rerender(<ChartTypeSelectorDropdown value="bar" onChange={mockOnChange} />);

    // Full width trigger
    const fullWidthTrigger = container.querySelector('.w-full');
    expect(fullWidthTrigger).toBeInTheDocument();

    // Proper spacing
    const wrapper = container.querySelector('.space-y-2');
    expect(wrapper).toBeInTheDocument();

    // Icon and text in flex layout
    const barText = screen.getByText('Bar Chart');
    const flexContainer = barText.closest('.flex');
    expect(flexContainer).toHaveClass('items-center', 'gap-2');
  });
});
