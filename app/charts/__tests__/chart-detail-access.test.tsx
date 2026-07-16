/**
 * ChartDetailClient: header Share affordance opens ShareModal; a 403 from
 * the chart fetch renders RequestAccessScreen instead of the error state.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartDetailClient } from '@/app/charts/[id]/ChartDetailClient';
import { useChart } from '@/hooks/api/useChart';
import { useRbac } from '@/lib/rbac';
import { useAccessRequests } from '@/hooks/api/useAccessRequests';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => {
  function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }
  return MockLink;
});

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

const mockEmptyQuery: { data: null; error: null; isLoading: boolean } = {
  data: null,
  error: null,
  isLoading: false,
};
const mockEmptyData: { data: null } = { data: null };

jest.mock('@/hooks/api/useChart', () => ({
  useChart: jest.fn(),
  useChartData: jest.fn(() => mockEmptyQuery),
  useChartDataPreview: jest.fn(() => mockEmptyQuery),
  useChartDataPreviewTotalRows: jest.fn(() => mockEmptyData),
  useGeoJSONData: jest.fn(() => mockEmptyQuery),
  useMapDataOverlay: jest.fn(() => mockEmptyQuery),
  useRegions: jest.fn(() => mockEmptyData),
  useChildRegions: jest.fn(() => mockEmptyData),
  useRegionGeoJSONs: jest.fn(() => mockEmptyData),
}));

jest.mock('@/lib/rbac', () => {
  const actual = jest.requireActual('@/lib/rbac');
  return {
    ...actual,
    useRbac: jest.fn(),
  };
});

jest.mock('@/components/charts/ChartPreview', () => ({
  ChartPreview: (): null => null,
}));
jest.mock('@/components/charts/TableChart', () => ({
  TableChart: (): null => null,
}));
jest.mock('@/components/charts/map/MapPreview', () => ({
  MapPreview: (): null => null,
}));
jest.mock('@/components/charts/ChartExportDropdown', () => ({
  ChartExportDropdown: (): null => null,
}));
jest.mock('sonner', () => ({ toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() } }));

jest.mock('@/hooks/api/useAccessRequests', () => ({
  ...jest.requireActual('@/hooks/api/useAccessRequests'),
  useAccessRequests: jest.fn(),
  createAccessRequest: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ getCurrentOrgUser: () => ({ email: 'sam.member@ngo.org' }) }),
}));

let lastShareModalProps: any = null;
jest.mock('@/components/ui/share-modal', () => ({
  ShareModal: (props: any) => {
    lastShareModalProps = props;
    if (!props.isOpen) return null;
    return <div data-testid="stub-share-modal">share-modal:{props.entityType}</div>;
  },
}));

const mockUseChart = useChart as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;
const mockUseAccessRequests = useAccessRequests as jest.Mock;

function setRbac(canShareCharts: boolean) {
  mockUseRbac.mockReturnValue({
    hasPermission: (perm: string) => (perm === 'can_share_charts' ? canShareCharts : true),
    role: 'admin',
    isLoaded: true,
    hasRole: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
}

describe('ChartDetailClient — header Share action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastShareModalProps = null;
    mockUseChart.mockReturnValue({ data: stableChartData, error: null, isLoading: false });
    mockUseAccessRequests.mockReturnValue({
      outgoing: [],
      isLoading: false,
      isError: undefined,
      mutate: jest.fn(),
    });
  });

  it('opens ShareModal with entityType="chart" when the header Share button is clicked', async () => {
    const user = userEvent.setup();
    setRbac(true);
    render(<ChartDetailClient chartId={5} />);

    await user.click(screen.getByTestId('chart-detail-share-button'));

    expect(screen.getByTestId('stub-share-modal')).toHaveTextContent('share-modal:chart');
    expect(lastShareModalProps.entityId).toBe(5);
    expect(lastShareModalProps.resourceName).toBe('Test Chart');
  });

  it('hides the header Share button when the viewer lacks can_share_charts', () => {
    setRbac(false);
    render(<ChartDetailClient chartId={5} />);

    expect(screen.queryByTestId('chart-detail-share-button')).not.toBeInTheDocument();
  });
});

describe('ChartDetailClient — request-access on 403', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setRbac(true);
    mockUseAccessRequests.mockReturnValue({
      outgoing: [],
      isLoading: false,
      isError: undefined,
      mutate: jest.fn(),
    });
  });

  it('renders RequestAccessScreen instead of the generic error state when the chart fetch 403s', () => {
    mockUseChart.mockReturnValue({
      data: undefined,
      error: Object.assign(new Error('You do not have access to this chart'), { status: 403 }),
      isLoading: false,
    });

    render(<ChartDetailClient chartId={5} />);

    expect(screen.getByTestId('request-access-screen')).toBeInTheDocument();
    expect(screen.getByText('Request access to this chart')).toBeInTheDocument();
    expect(screen.queryByText(/isn't ready yet/i)).not.toBeInTheDocument();
  });

  it('still renders the generic error state for a non-403 error (e.g. 404)', () => {
    mockUseChart.mockReturnValue({
      data: undefined,
      error: Object.assign(new Error('Chart not found'), { status: 404 }),
      isLoading: false,
    });

    render(<ChartDetailClient chartId={5} />);

    expect(screen.queryByTestId('request-access-screen')).not.toBeInTheDocument();
    expect(screen.getByText(/isn't ready yet/i)).toBeInTheDocument();
  });
});
