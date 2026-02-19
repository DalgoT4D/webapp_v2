/**
 * Tests for chart back button navigation flows.
 *
 * Scenarios covered:
 * 1. From charts list → chart edit → back/cancel/save → stays in charts flow
 * 2. From dashboard → chart edit → back/cancel/save → returns to dashboard
 * 3. Chart detail back button behavior based on origin
 */

import { render, screen, fireEvent, act } from '@testing-library/react';

// --- Next.js navigation mock ---
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
  useParams: () => ({ id: '5' }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/charts/5/edit',
}));

jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

// --- API / SWR hook mocks ---
// IMPORTANT: Define chart data outside the mock factory so it returns a stable
// reference. The EditChartPage component has a useEffect([chart]) that sets form
// data — a new object reference each render would trigger an infinite re-render loop.
const stableChartData = {
  id: 5,
  title: 'Test Chart',
  chart_type: 'bar',
  computation_type: 'aggregated',
  schema_name: 'public',
  table_name: 'sales',
  extra_config: {
    dimension_column: 'category',
    aggregate_column: 'amount',
    aggregate_function: 'sum',
    customizations: {},
  },
};

const mockUpdateChart = jest.fn().mockResolvedValue({});
const mockCreateChart = jest.fn().mockResolvedValue({ id: 10 });

jest.mock('@/hooks/api/useChart', () => ({
  useChart: (): { data: typeof stableChartData; error: null; isLoading: false } => ({
    data: stableChartData,
    error: null,
    isLoading: false,
  }),
  useUpdateChart: (): { trigger: typeof mockUpdateChart; isMutating: false } => ({
    trigger: mockUpdateChart,
    isMutating: false,
  }),
  useCreateChart: (): { trigger: typeof mockCreateChart; isMutating: false } => ({
    trigger: mockCreateChart,
    isMutating: false,
  }),
  useChartData: (): { data: null; error: null; isLoading: false } => ({
    data: null,
    error: null,
    isLoading: false,
  }),
  useChartDataPreview: (): { data: null; error: null; isLoading: false } => ({
    data: null,
    error: null,
    isLoading: false,
  }),
  useChartDataPreviewTotalRows: (): { data: null } => ({ data: null }),
  useGeoJSONData: (): { data: null; error: null; isLoading: false } => ({
    data: null,
    error: null,
    isLoading: false,
  }),
  useMapDataOverlay: (): { data: null; error: null; isLoading: false } => ({
    data: null,
    error: null,
    isLoading: false,
  }),
  useRawTableData: (): { data: null; error: null; isLoading: false } => ({
    data: null,
    error: null,
    isLoading: false,
  }),
  useTableCount: (): { data: null } => ({ data: null }),
  useColumns: (): { data: null } => ({ data: null }),
  useRegions: (): { data: null } => ({ data: null }),
  useChildRegions: (): { data: null } => ({ data: null }),
  useRegionGeoJSONs: (): { data: null } => ({ data: null }),
}));

jest.mock('@/hooks/api/usePermissions', () => ({
  useUserPermissions: () => ({
    hasPermission: () => true,
  }),
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { updated: jest.fn(), created: jest.fn() },
  toastError: { update: jest.fn(), create: jest.fn() },
}));

jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

// Mock heavy chart components to keep tests fast
jest.mock('@/components/charts/ChartDataConfigurationV3', () => ({
  ChartDataConfigurationV3: () => <div data-testid="mock-data-config" />,
}));
jest.mock('@/components/charts/ChartCustomizations', () => ({
  ChartCustomizations: () => <div data-testid="mock-chart-customizations" />,
}));
jest.mock('@/components/charts/ChartPreview', () => ({
  ChartPreview: () => <div data-testid="mock-chart-preview" />,
}));
jest.mock('@/components/charts/DataPreview', () => ({
  DataPreview: () => <div data-testid="mock-data-preview" />,
}));
jest.mock('@/components/charts/TableChart', () => ({
  TableChart: () => <div data-testid="mock-table-chart" />,
}));
jest.mock('@/components/charts/ChartExportDropdown', () => ({
  ChartExportDropdown: () => <div data-testid="mock-chart-export" />,
}));
jest.mock('@/components/charts/map/MapDataConfigurationV3', () => ({
  MapDataConfigurationV3: () => <div data-testid="mock-map-config" />,
}));
jest.mock('@/components/charts/map/MapCustomizations', () => ({
  MapCustomizations: () => <div data-testid="mock-map-customizations" />,
}));
jest.mock('@/components/charts/map/MapPreview', () => ({
  MapPreview: () => <div data-testid="mock-map-preview" />,
}));
jest.mock('@/components/charts/SaveOptionsDialog', () => ({
  SaveOptionsDialog: ({ open, onSaveExisting, onSaveAsNew }: any) =>
    open ? (
      <div data-testid="save-options-dialog">
        <button data-testid="save-existing-button" onClick={onSaveExisting}>
          Update Existing
        </button>
        <button data-testid="save-as-new-button" onClick={() => onSaveAsNew('New Chart Title')}>
          Save as New
        </button>
      </div>
    ) : null,
}));
jest.mock('@/components/charts/UnsavedChangesExitDialog', () => ({
  UnsavedChangesExitDialog: ({ open, onLeave, onSave }: any) =>
    open ? (
      <div data-testid="exit-dialog">
        <button data-testid="leave-without-saving" onClick={onLeave}>
          Leave
        </button>
        <button data-testid="save-and-leave" onClick={onSave}>
          Save & Leave
        </button>
      </div>
    ) : null,
}));
jest.mock('@/components/ui/confirmation-dialog', () => ({
  ConfirmationDialog: (): null => null,
}));

// Import after mocks
import EditChartPage from '@/app/charts/[id]/edit/page';
import { ChartDetailClient } from '@/app/charts/[id]/ChartDetailClient';

// Suppress noisy console.log from the component's debug logging
const originalLog = console.log;
beforeAll(() => {
  console.log = (...args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('[UNSAVED-CHANGES]') || msg.includes('[FORM-DATA]')) return;
    originalLog(...args);
  };
});
afterAll(() => {
  console.log = originalLog;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

// ============================================================
// Chart Edit Page — Navigation from Charts (existing flow)
// ============================================================
describe('Chart Edit Page — from Charts (no from param)', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams(); // no ?from=
  });

  it('renders "Back" label (not "Back to Dashboard")', () => {
    render(<EditChartPage />);
    const backBtn = screen.getByTestId('chart-edit-back-button');
    expect(backBtn).toHaveTextContent('Back');
    expect(backBtn).not.toHaveTextContent('Back to Dashboard');
  });

  it('back button navigates to chart detail via router.push', () => {
    render(<EditChartPage />);
    fireEvent.click(screen.getByTestId('chart-edit-back-button'));
    expect(mockPush).toHaveBeenCalledWith('/charts/5');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('cancel button navigates to chart detail via router.push', () => {
    render(<EditChartPage />);
    fireEvent.click(screen.getByTestId('chart-edit-cancel-button'));
    expect(mockPush).toHaveBeenCalledWith('/charts/5');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('save (update existing) navigates to chart detail via router.push', async () => {
    render(<EditChartPage />);

    // Click Save to open dialog
    fireEvent.click(screen.getByTestId('chart-edit-save-button'));

    // Click "Update Existing" in save dialog
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-existing-button'));
    });

    expect(mockUpdateChart).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/charts/5');
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('save as new navigates to new chart detail via router.push', async () => {
    render(<EditChartPage />);

    fireEvent.click(screen.getByTestId('chart-edit-save-button'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-as-new-button'));
    });

    expect(mockCreateChart).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/charts/10');
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });
});

// ============================================================
// Chart Edit Page — Navigation from Dashboard
// ============================================================
describe('Chart Edit Page — from Dashboard (?from=dashboard)', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('from=dashboard');
  });

  it('renders "Back to Dashboard" label', () => {
    render(<EditChartPage />);
    const backBtn = screen.getByTestId('chart-edit-back-button');
    expect(backBtn).toHaveTextContent('Back to Dashboard');
  });

  it('back button uses router.back() to return to dashboard', () => {
    render(<EditChartPage />);
    fireEvent.click(screen.getByTestId('chart-edit-back-button'));
    expect(mockBack).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('cancel button uses router.back() to return to dashboard', () => {
    render(<EditChartPage />);
    fireEvent.click(screen.getByTestId('chart-edit-cancel-button'));
    expect(mockBack).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('save (update existing) uses router.replace with ?from=dashboard', async () => {
    render(<EditChartPage />);

    fireEvent.click(screen.getByTestId('chart-edit-save-button'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-existing-button'));
    });

    expect(mockUpdateChart).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/charts/5?from=dashboard');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('save as new preserves ?from=dashboard via router.replace', async () => {
    render(<EditChartPage />);

    fireEvent.click(screen.getByTestId('chart-edit-save-button'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-as-new-button'));
    });

    expect(mockCreateChart).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/charts/10?from=dashboard');
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ============================================================
// Chart Detail Page — Back button behavior
// ============================================================
describe('Chart Detail Page — back navigation', () => {
  it('without from param: renders link to /charts', () => {
    mockSearchParams = new URLSearchParams();
    render(<ChartDetailClient chartId={5} />);

    const backLink = screen.getByTestId('chart-detail-back-link');
    expect(backLink).toHaveAttribute('href', '/charts');
    expect(screen.getByTestId('chart-detail-back-button')).toHaveTextContent('Back');
  });

  it('with from=dashboard: renders "Back to Dashboard" button with router.back()', () => {
    mockSearchParams = new URLSearchParams('from=dashboard');
    render(<ChartDetailClient chartId={5} />);

    const backBtn = screen.getByTestId('chart-detail-back-dashboard');
    expect(backBtn).toHaveTextContent('Back to Dashboard');

    fireEvent.click(backBtn);
    expect(mockBack).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('with from=dashboard: edit link includes ?from=dashboard', () => {
    mockSearchParams = new URLSearchParams('from=dashboard');
    render(<ChartDetailClient chartId={5} />);

    const editLink = screen.getByTestId('chart-detail-edit-link');
    expect(editLink).toHaveAttribute('href', '/charts/5/edit?from=dashboard');
  });

  it('without from param: edit link has no from param', () => {
    mockSearchParams = new URLSearchParams();
    render(<ChartDetailClient chartId={5} />);

    const editLink = screen.getByTestId('chart-detail-edit-link');
    expect(editLink).toHaveAttribute('href', '/charts/5/edit');
  });
});
