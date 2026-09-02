import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { KPI } from '@/types/kpis';
import { KPIPageComponent } from '../kpi-page';
import { useKPI, useKPIs, useProgramTags } from '@/hooks/api/useKPIs';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
  useSWRConfig: () => ({ mutate: jest.fn() }),
}));

jest.mock('@/hooks/api/useKPIs', () => ({
  useKPIs: jest.fn(),
  useKPI: jest.fn(),
  useKPIData: jest.fn(),
  useProgramTags: jest.fn(),
  deleteKPI: jest.fn(),
}));

jest.mock('@/lib/rbac', () => ({
  PERMISSIONS: {
    CAN_CREATE_KPIS: 'can_create_kpis',
    CAN_EDIT_KPIS: 'can_edit_kpis',
    CAN_DELETE_KPIS: 'can_delete_kpis',
    CAN_CREATE_ALERTS: 'can_create_alerts',
  },
  useRbac: () => ({ hasPermission: () => true }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { orgUsers: never[]; selectedOrgSlug: null }) => unknown) =>
    selector({ orgUsers: [], selectedOrgSlug: null }),
}));

jest.mock('@/stores/insightWalkthroughStore', () => ({
  useInsightWalkthroughStore: {
    getState: () => ({
      active: false,
      setSuppressCoachmark: jest.fn(),
      advanceIfBefore: jest.fn(),
      advanceTo: jest.fn(),
    }),
  },
}));

jest.mock('@/components/ui/docs-link', () => ({
  DocsLink: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../kpi-form', () => ({
  KPIForm: ({ open, kpi }: { open: boolean; kpi: KPI | null }) =>
    open ? <div data-testid="kpi-form">Editing {kpi?.name ?? 'new KPI'}</div> : null,
}));

jest.mock('../kpi-detail-drawer', () => ({
  KPIDetailDrawer: ({ open, kpi }: { open: boolean; kpi: KPI | null }) =>
    open ? <div data-testid="kpi-drawer">Viewing {kpi?.name}</div> : null,
}));

jest.mock('../kpi-delete-dialog', () => ({ KPIDeleteDialog: (): null => null }));
jest.mock('@/components/onboarding/celebration-modal', () => ({
  CelebrationModal: (): null => null,
}));
jest.mock('@/components/alerts/AlertWizardModal', () => ({ AlertWizardModal: (): null => null }));

const deepLinkedKpi = {
  id: 99,
  name: 'Learners reached',
  metric: {},
  target_value: 100,
  direction: 'increase',
  green_threshold_pct: 90,
  amber_threshold_pct: 70,
  time_grain: 'monthly',
  time_dimension_column: null,
  metric_type_tag: 'output',
  program_tags: [],
  display_order: 0,
  extra_config: {},
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
} as KPI;

const mockUseKPIs = useKPIs as jest.MockedFunction<typeof useKPIs>;
const mockUseKPI = useKPI as jest.MockedFunction<typeof useKPI>;
const mockUseProgramTags = useProgramTags as jest.MockedFunction<typeof useProgramTags>;

describe('KPI dashboard/report deep links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseKPIs.mockReturnValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
      isLoading: false,
      isError: undefined,
      mutate: jest.fn(),
    });
    mockUseKPI.mockReturnValue({
      kpi: deepLinkedKpi,
      isLoading: false,
      isError: undefined,
      mutate: jest.fn(),
    });
    mockUseProgramTags.mockReturnValue({ tags: [], isLoading: false, mutate: jest.fn() });
  });

  it('loads a KPI by id and opens its drawer even when it is not on the current list page', async () => {
    mockSearchParams = new URLSearchParams('open=99&from=dashboard');
    render(<KPIPageComponent />);

    expect(useKPI).toHaveBeenCalledWith(99);
    expect(await screen.findByTestId('kpi-drawer')).toHaveTextContent('Viewing Learners reached');
    expect(mockReplace).toHaveBeenCalledWith('/kpis?from=dashboard', { scroll: false });

    fireEvent.click(screen.getByTestId('kpi-back-to-source'));
    expect(mockBack).toHaveBeenCalled();
    expect(screen.getByTestId('kpi-back-to-source')).toHaveTextContent('Back to Dashboard');
  });

  it('opens the KPI edit form and preserves report return context', async () => {
    mockSearchParams = new URLSearchParams('edit=99&from=report');
    render(<KPIPageComponent />);

    expect(await screen.findByTestId('kpi-form')).toHaveTextContent('Editing Learners reached');
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/kpis?from=report', { scroll: false })
    );
    expect(screen.getByTestId('kpi-back-to-source')).toHaveTextContent('Back to Report');
  });
});
