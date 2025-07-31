import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChartCard from '@/components/charts/ChartCard';

const mockChart = {
  id: 1,
  title: 'Test Chart',
  description: 'Test description',
  chart_type: 'echarts',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
  is_public: false,
  config: {},
};

describe('ChartCard Component', () => {
  const mockOnView = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render chart information', () => {
    render(
      <ChartCard
        chart={mockChart}
        onView={mockOnView}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
  });

  it('should show public badge for public charts', () => {
    const publicChart = { ...mockChart, is_public: true };

    render(
      <ChartCard
        chart={publicChart}
        onView={mockOnView}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('Public')).toBeInTheDocument();
  });

  it('should call onView when view button is clicked', () => {
    render(
      <ChartCard
        chart={mockChart}
        onView={mockOnView}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.click(screen.getByText('View'));
    expect(mockOnView).toHaveBeenCalledWith(mockChart);
  });

  it('should call onEdit when edit button is clicked', () => {
    render(
      <ChartCard
        chart={mockChart}
        onView={mockOnView}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.click(screen.getByText('Edit'));
    expect(mockOnEdit).toHaveBeenCalledWith(mockChart);
  });

  it('should call onDelete when delete button is clicked', () => {
    render(
      <ChartCard
        chart={mockChart}
        onView={mockOnView}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.click(screen.getByText('Delete'));
    expect(mockOnDelete).toHaveBeenCalledWith(mockChart);
  });

  it('should render without description', () => {
    const chartWithoutDesc = { ...mockChart, description: undefined };

    render(
      <ChartCard
        chart={chartWithoutDesc}
        onView={mockOnView}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.queryByText('Test description')).not.toBeInTheDocument();
  });

  it('should show relative time for updated_at', () => {
    render(
      <ChartCard
        chart={mockChart}
        onView={mockOnView}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // The exact text depends on when the test runs, but it should contain "ago"
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });
});
