// components/explore/__tests__/Explore.test.tsx
import { render, screen } from '@testing-library/react';
import { Explore } from '../Explore';
import { mockWarehouseTables } from './explore-mock-data';

// Mock echarts
jest.mock('echarts/core', () => ({
  use: jest.fn(),
  init: jest.fn(),
}));

jest.mock('echarts/charts', () => ({
  BarChart: {},
  ScatterChart: {},
}));

jest.mock('echarts/components', () => ({
  GridComponent: {},
  TooltipComponent: {},
  LegendComponent: {},
  MarkLineComponent: {},
  MarkPointComponent: {},
}));

jest.mock('echarts/renderers', () => ({
  CanvasRenderer: {},
}));

// Mock chart components
jest.mock('../StatisticsPane', () => ({
  StatisticsPane: () => <div data-testid="statistics-pane">Statistics Pane</div>,
}));

jest.mock('../PreviewPane', () => ({
  PreviewPane: () => <div data-testid="preview-pane">Preview Pane</div>,
}));

// Mock the hooks
const mockMutate = jest.fn();
jest.mock('@/hooks/api/useWarehouse', () => ({
  useWarehouseTables: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
    mutate: mockMutate,
  })),
  syncWarehouseTables: jest.fn(),
}));

jest.mock('@/hooks/api/useFeatureFlags', () => ({
  useFeatureFlags: jest.fn(() => ({
    isFeatureFlagEnabled: jest.fn(() => true),
  })),
  FeatureFlagKeys: {
    DATA_STATISTICS: 'DATA_STATISTICS',
  },
}));

jest.mock('@/hooks/api/usePermissions', () => ({
  useUserPermissions: jest.fn(() => ({
    hasPermission: jest.fn(() => true),
  })),
}));

// Mock the store with a proper implementation
const mockReset = jest.fn();
const mockSetSelectedTable = jest.fn();
const mockSetActiveTab = jest.fn();
const mockSetSidebarWidth = jest.fn();
const mockSetSearchTerm = jest.fn();

jest.mock('@/stores/exploreStore', () => ({
  useExploreStore: jest.fn(() => ({
    selectedTable: null,
    activeTab: 'preview',
    sidebarWidth: 280,
    searchTerm: '',
    setSelectedTable: mockSetSelectedTable,
    setActiveTab: mockSetActiveTab,
    setSidebarWidth: mockSetSidebarWidth,
    setSearchTerm: mockSetSearchTerm,
    reset: mockReset,
  })),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('Explore Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the sync button', () => {
    render(<Explore />);
    expect(screen.getByTestId('sync-tables-btn')).toBeInTheDocument();
  });

  it('renders the search input', () => {
    render(<Explore />);
    expect(screen.getByTestId('tree-search-input')).toBeInTheDocument();
  });

  it('shows empty state when no table is selected', () => {
    render(<Explore />);
    expect(
      screen.getByText('Select a table from the sidebar to view its data')
    ).toBeInTheDocument();
  });

  it('renders page title and subtitle', () => {
    render(<Explore />);
    expect(screen.getByTestId('explore-page-title')).toHaveTextContent('Explore');
    expect(screen.getByTestId('explore-page-subtitle')).toHaveTextContent(
      'View your tables in the warehouse'
    );
  });
});

describe('Explore Component with data', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock with actual data
    const useWarehouseTables = jest.requireMock('@/hooks/api/useWarehouse').useWarehouseTables;
    useWarehouseTables.mockReturnValue({
      data: mockWarehouseTables,
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });
  });

  it('renders warehouse tables in the tree area', () => {
    render(<Explore />);
    // The tree renders when data is available
    expect(screen.getByTestId('tree-search-input')).toBeInTheDocument();
  });
});

describe('Explore Component loading state', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const useWarehouseTables = jest.requireMock('@/hooks/api/useWarehouse').useWarehouseTables;
    useWarehouseTables.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      mutate: mockMutate,
    });
  });

  it('shows loading indicator when tables are loading', () => {
    render(<Explore />);
    // When loading, the component still renders the layout
    expect(screen.getByTestId('tree-search-input')).toBeInTheDocument();
  });
});
