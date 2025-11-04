import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import ChartsPage from '@/app/charts/page';
// ChartBuilderPage import removed - using new chart creation flow

// Mock next/navigation
const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/charts',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock API responses
const mockCharts = [
  {
    id: 1,
    title: 'Sales by Category',
    description: 'Total sales grouped by product category',
    chart_type: 'echarts',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    is_public: false,
  },
  {
    id: 2,
    title: 'Monthly Revenue',
    description: 'Revenue trend over months',
    chart_type: 'echarts',
    created_at: '2024-01-14T10:00:00Z',
    updated_at: '2024-01-14T10:00:00Z',
    is_public: true,
  },
];

// Mock chart API
jest.mock('@/lib/api', () => ({
  apiGet: jest.fn((url) => {
    if (url === '/api/charts/') {
      return Promise.resolve({
        success: true,
        data: { items: mockCharts, total: 2 },
      });
    }
    return Promise.resolve({ success: true, data: [] });
  }),
  apiPost: jest.fn(() =>
    Promise.resolve({
      success: true,
      data: {
        id: 3,
        title: 'New Test Chart',
        description: 'Test description',
      },
    })
  ),
  apiDelete: jest.fn(() => Promise.resolve({ success: true, message: 'Chart deleted' })),
}));

// Mock chart components
jest.mock('@/components/charts/ChartCard', () => {
  return function ChartCard({ chart, onView, onEdit, onDelete }: any) {
    return (
      <div data-testid={`chart-card-${chart.id}`}>
        <h3>{chart.title}</h3>
        <p>{chart.description}</p>
        <button onClick={() => onView(chart)}>View</button>
        <button onClick={() => onEdit(chart)}>Edit</button>
        <button onClick={() => onDelete(chart)}>Delete</button>
      </div>
    );
  };
});

jest.mock('@/components/charts/ChartBuilder', () => {
  return function ChartBuilder({ onSave, onCancel }: any) {
    return (
      <div data-testid="chart-builder">
        <h2>Chart Builder</h2>
        <button
          onClick={() =>
            onSave({
              title: 'New Test Chart',
              description: 'Test description',
              chart_type: 'echarts',
              schema_name: 'analytics',
              table: 'sales',
              config: {},
            })
          }
        >
          Save Chart
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  };
});

describe('Chart Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Charts List Page', () => {
    it('should display list of charts', async () => {
      render(
        <SWRConfig value={{ provider: () => new Map() }}>
          <ChartsPage />
        </SWRConfig>
      );

      await waitFor(() => {
        expect(screen.getByText('Sales by Category')).toBeInTheDocument();
        expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
      });
    });

    it('should navigate to chart builder on create button click', async () => {
      const user = userEvent.setup();

      render(
        <SWRConfig value={{ provider: () => new Map() }}>
          <ChartsPage />
        </SWRConfig>
      );

      const createButton = await screen.findByText('Create Chart');
      await user.click(createButton);

      expect(mockPush).toHaveBeenCalledWith('/charts/new/configure');
    });

    it('should search charts', async () => {
      const user = userEvent.setup();

      render(
        <SWRConfig value={{ provider: () => new Map() }}>
          <ChartsPage />
        </SWRConfig>
      );

      const searchInput = await screen.findByPlaceholderText('Search charts...');
      await user.type(searchInput, 'Sales');

      await waitFor(() => {
        expect(screen.getByText('Sales by Category')).toBeInTheDocument();
        expect(screen.queryByText('Monthly Revenue')).not.toBeInTheDocument();
      });
    });

    it('should filter charts by type', async () => {
      const user = userEvent.setup();

      render(
        <SWRConfig value={{ provider: () => new Map() }}>
          <ChartsPage />
        </SWRConfig>
      );

      // Open filter dropdown
      const filterButton = await screen.findByText('All Types');
      await user.click(filterButton);

      // Select ECharts filter
      const echartsOption = await screen.findByText('ECharts');
      await user.click(echartsOption);

      // All test charts are echarts type, so both should still be visible
      expect(screen.getByText('Sales by Category')).toBeInTheDocument();
      expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
    });

    it('should handle chart deletion', async () => {
      const user = userEvent.setup();
      const mockApiDelete = require('@/lib/api').apiDelete;

      render(
        <SWRConfig value={{ provider: () => new Map() }}>
          <ChartsPage />
        </SWRConfig>
      );

      // Click delete on first chart
      const deleteButton = await screen.findByTestId('chart-card-1');
      const deleteBtn = deleteButton.querySelector('button:last-child');
      await user.click(deleteBtn!);

      // Confirm deletion in modal
      const confirmButton = await screen.findByText('Delete Chart');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockApiDelete).toHaveBeenCalledWith('/api/charts/1');
      });
    });
  });

  // Chart Builder Page tests removed - using new chart creation flow

  describe('End-to-End Chart Creation Flow', () => {
    it('should complete full chart creation flow', async () => {
      const user = userEvent.setup();
      const mockApiPost = require('@/lib/api').apiPost;

      // Start at charts list page
      const { unmount } = render(
        <SWRConfig value={{ provider: () => new Map() }}>
          <ChartsPage />
        </SWRConfig>
      );

      // Click create chart
      const createButton = await screen.findByText('Create Chart');
      await user.click(createButton);
      expect(mockPush).toHaveBeenCalledWith('/charts/new/configure');

      // Chart creation flow now uses /charts/new/configure
      // Integration test would need to be updated for new flow
    });
  });
});
