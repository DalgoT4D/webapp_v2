/**
 * Tests for ChartWithExport component
 * Tests chart rendering with export functionality
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ChartWithExport } from '../ChartWithExport';

// Mock child components
jest.mock('../ChartPreview', () => ({
  ChartPreview: ({
    config,
    isLoading,
    error,
    onChartReady,
  }: {
    config: any;
    isLoading?: boolean;
    error?: any;
    onChartReady: (instance: any) => void;
  }) => (
    <div data-testid="chart-preview" data-loading={isLoading} data-error={!!error}>
      Chart Preview Mock
      <button onClick={() => onChartReady({ mockInstance: true })}>Ready</button>
    </div>
  ),
}));

jest.mock('../ChartExport', () => ({
  __esModule: true,
  default: ({ chartId, chartTitle, chartInstance }: any) => (
    <div
      data-testid="chart-export"
      data-chart-id={chartId}
      data-chart-title={chartTitle}
      data-has-instance={!!chartInstance}
    >
      Chart Export Mock
    </div>
  ),
}));

describe('ChartWithExport', () => {
  const defaultProps = {
    chartId: 1,
    chartTitle: 'Test Chart',
    chartConfig: { type: 'bar', data: [] },
  };

  it('should render all UI elements and pass props correctly', () => {
    let result = render(<ChartWithExport {...defaultProps} />);
    let { container } = result;

    // Both main components should be present
    expect(screen.getByTestId('chart-preview')).toBeInTheDocument();
    expect(screen.getByTestId('chart-export')).toBeInTheDocument();

    // Props passed correctly
    const exportComponent = screen.getByTestId('chart-export');
    expect(exportComponent).toHaveAttribute('data-chart-id', '1');
    expect(exportComponent).toHaveAttribute('data-chart-title', 'Test Chart');
    expect(exportComponent).toHaveAttribute('data-has-instance', 'false');

    // Pass loading state to ChartPreview
    result.rerender(<ChartWithExport {...defaultProps} isLoading={true} />);
    let previewComponent = screen.getByTestId('chart-preview');
    expect(previewComponent).toHaveAttribute('data-loading', 'true');

    // Pass error state to ChartPreview
    result.rerender(<ChartWithExport {...defaultProps} error={new Error('Test error')} />);
    previewComponent = screen.getByTestId('chart-preview');
    expect(previewComponent).toHaveAttribute('data-error', 'true');

    result.unmount();

    // Layout structure
    result = render(<ChartWithExport {...defaultProps} />);
    container = result.container;
    const wrapper = container.querySelector('.relative');
    expect(wrapper).toBeInTheDocument();

    const exportContainer = container.querySelector('.absolute');
    expect(exportContainer).toBeInTheDocument();

    const topRightContainer = container.querySelector('.top-2.right-2');
    expect(topRightContainer).toBeInTheDocument();
  });

  it('should manage chart instance lifecycle and handle props updates', () => {
    const { rerender } = render(<ChartWithExport {...defaultProps} />);

    // Initially no instance
    let exportComponent = screen.getByTestId('chart-export');
    expect(exportComponent).toHaveAttribute('data-has-instance', 'false');

    // Simulate chart ready
    const readyButton = screen.getByRole('button', { name: /ready/i });
    act(() => {
      readyButton.click();
    });

    // Re-render to see updated state
    rerender(<ChartWithExport {...defaultProps} />);
    exportComponent = screen.getByTestId('chart-export');
    expect(exportComponent).toHaveAttribute('data-has-instance', 'true');

    // Update chartId
    rerender(<ChartWithExport {...defaultProps} chartId={999} />);
    exportComponent = screen.getByTestId('chart-export');
    expect(exportComponent).toHaveAttribute('data-chart-id', '999');

    // Update chartTitle
    rerender(<ChartWithExport {...defaultProps} chartTitle="New Title" />);
    exportComponent = screen.getByTestId('chart-export');
    expect(exportComponent).toHaveAttribute('data-chart-title', 'New Title');

    // Update chartConfig
    const newConfig = { type: 'line' };
    rerender(<ChartWithExport {...defaultProps} chartConfig={newConfig} />);
    expect(screen.getByTestId('chart-preview')).toBeInTheDocument();

    // State transitions
    rerender(<ChartWithExport {...defaultProps} isLoading={true} />);
    let previewComponent = screen.getByTestId('chart-preview');
    expect(previewComponent).toHaveAttribute('data-loading', 'true');

    rerender(<ChartWithExport {...defaultProps} isLoading={false} />);
    previewComponent = screen.getByTestId('chart-preview');
    expect(previewComponent).toHaveAttribute('data-loading', 'false');

    rerender(<ChartWithExport {...defaultProps} error={new Error('Test')} />);
    previewComponent = screen.getByTestId('chart-preview');
    expect(previewComponent).toHaveAttribute('data-error', 'true');

    rerender(<ChartWithExport {...defaultProps} />);
    previewComponent = screen.getByTestId('chart-preview');
    expect(previewComponent).toHaveAttribute('data-error', 'false');
  });

  it('should handle edge case values gracefully', () => {
    // Empty chartConfig
    const { rerender } = render(<ChartWithExport {...defaultProps} chartConfig={{}} />);
    expect(screen.getByTestId('chart-preview')).toBeInTheDocument();

    // Null chartConfig
    rerender(<ChartWithExport {...defaultProps} chartConfig={null as any} />);
    expect(screen.getByTestId('chart-preview')).toBeInTheDocument();

    // Empty chartTitle
    rerender(<ChartWithExport {...defaultProps} chartTitle="" />);
    const exportComponent = screen.getByTestId('chart-export');
    expect(exportComponent).toHaveAttribute('data-chart-title', '');

    // Zero chartId
    rerender(<ChartWithExport {...defaultProps} chartId={0} />);
    expect(exportComponent).toHaveAttribute('data-chart-id', '0');
  });
});
