/**
 * Tests for ChartTypeSelector component
 * Tests the 6 actual chart types: bar, line, pie, number, map, table
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartTypeSelector } from '../ChartTypeSelector';

describe('ChartTypeSelector', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all 6 chart types and handle selection correctly', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ChartTypeSelector onChange={mockOnChange} />);

    // All 6 chart type buttons and heading
    expect(screen.getByTitle('Bar Chart')).toBeInTheDocument();
    expect(screen.getByTitle('Line Chart')).toBeInTheDocument();
    expect(screen.getByTitle('Pie Chart')).toBeInTheDocument();
    expect(screen.getByTitle('Big Number')).toBeInTheDocument();
    expect(screen.getByTitle('Map')).toBeInTheDocument();
    expect(screen.getByTitle('Table')).toBeInTheDocument();
    expect(screen.getByText('Chart Type')).toBeInTheDocument();

    // Default selection (bar chart)
    expect(screen.getByText('Compare values across categories')).toBeInTheDocument();

    // Line chart selected
    rerender(<ChartTypeSelector value="line" onChange={mockOnChange} />);
    const lineButton = screen.getByTitle('Line Chart');
    expect(lineButton).toHaveClass('shadow-sm');

    // Select pie chart
    const pieButton = screen.getByTitle('Pie Chart');
    await user.click(pieButton);
    expect(mockOnChange).toHaveBeenCalledWith('pie');
    expect(mockOnChange).toHaveBeenCalledTimes(1);

    // Update description
    rerender(<ChartTypeSelector value="pie" onChange={mockOnChange} />);
    expect(screen.getByText('Show proportions of a whole')).toBeInTheDocument();

    // Clicking same chart type
    mockOnChange.mockClear();
    await user.click(pieButton);
    expect(mockOnChange).toHaveBeenCalledWith('pie');

    // Select all chart types
    mockOnChange.mockClear();
    const chartTypes = [
      { title: 'Bar Chart', id: 'bar' },
      { title: 'Line Chart', id: 'line' },
      { title: 'Pie Chart', id: 'pie' },
      { title: 'Big Number', id: 'number' },
      { title: 'Map', id: 'map' },
      { title: 'Table', id: 'table' },
    ];

    for (const type of chartTypes) {
      const button = screen.getByTitle(type.title);
      await user.click(button);
      expect(mockOnChange).toHaveBeenCalledWith(type.id);
    }
    expect(mockOnChange).toHaveBeenCalledTimes(6);
  });

  it('should handle disabled state, show correct descriptions, and have proper layout', async () => {
    const user = userEvent.setup();
    let result = render(<ChartTypeSelector onChange={mockOnChange} disabled={true} />);

    // Disabled state
    let buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });

    const pieButton = screen.getByTitle('Pie Chart');
    await user.click(pieButton);
    expect(mockOnChange).not.toHaveBeenCalled();

    // Enable buttons
    result.rerender(<ChartTypeSelector onChange={mockOnChange} disabled={false} />);
    buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).not.toBeDisabled();
    });

    // Clean up before testing descriptions
    result.unmount();

    // Show correct description for each chart type
    const chartTypeDescriptions = [
      { value: 'bar', description: 'Compare values across categories' },
      { value: 'line', description: 'Display trends over time' },
      { value: 'pie', description: 'Show proportions of a whole' },
      { value: 'number', description: 'Display a single key metric prominently' },
      { value: 'map', description: 'Visualize geographic data' },
      { value: 'table', description: 'Display data in rows and columns' },
    ];

    for (const { value, description } of chartTypeDescriptions) {
      const { unmount } = render(<ChartTypeSelector value={value} onChange={mockOnChange} />);
      expect(screen.getByText(description)).toBeInTheDocument();
      unmount();
    }

    // Visual styling and layout
    result = render(<ChartTypeSelector value="pie" onChange={mockOnChange} />);
    const { container } = result;
    const pieButtonSelected = screen.getByTitle('Pie Chart');
    expect(pieButtonSelected).toHaveClass('shadow-sm');

    // All buttons should contain SVG icons
    const allButtons = screen.getAllByRole('button');
    expect(allButtons).toHaveLength(6);

    allButtons.forEach((button) => {
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    // Grid layout
    const gridContainer = container.querySelector('.grid');
    expect(gridContainer).toBeInTheDocument();
    expect(gridContainer).toHaveClass('grid-cols-6');
  });

  it('should handle edge cases and meet accessibility requirements', async () => {
    const user = userEvent.setup();

    // Edge case values
    const { rerender } = render(<ChartTypeSelector value={undefined} onChange={mockOnChange} />);
    expect(screen.getByText('Compare values across categories')).toBeInTheDocument();

    // Empty string value
    rerender(<ChartTypeSelector value="" onChange={mockOnChange} />);
    expect(screen.getByText('Compare values across categories')).toBeInTheDocument();

    // Rapid selection changes
    mockOnChange.mockClear();
    rerender(<ChartTypeSelector onChange={mockOnChange} />);

    const lineButton = screen.getByTitle('Line Chart');
    const pieButton = screen.getByTitle('Pie Chart');

    await user.click(lineButton);
    await user.click(pieButton);
    await user.click(lineButton);

    expect(mockOnChange).toHaveBeenCalledTimes(3);
    expect(mockOnChange).toHaveBeenNthCalledWith(1, 'line');
    expect(mockOnChange).toHaveBeenNthCalledWith(2, 'pie');
    expect(mockOnChange).toHaveBeenNthCalledWith(3, 'line');

    // Accessibility - accessible button roles
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(6);

    // Title attributes for screen readers
    expect(screen.getByTitle('Bar Chart')).toBeInTheDocument();
    expect(screen.getByTitle('Line Chart')).toBeInTheDocument();
    expect(screen.getByTitle('Pie Chart')).toBeInTheDocument();
    expect(screen.getByTitle('Big Number')).toBeInTheDocument();
    expect(screen.getByTitle('Map')).toBeInTheDocument();
    expect(screen.getByTitle('Table')).toBeInTheDocument();

    // Keyboard navigation - buttons are keyboard accessible with proper focus styles
    const allButtonsForNav = screen.getAllByRole('button');
    // Check that buttons have outline-none and focus-visible styles for accessibility
    expect(allButtonsForNav[0]).toHaveClass('outline-none');
    expect(allButtonsForNav[0].className).toMatch(/focus-visible/); // Has some focus-visible styling
  });
});
