import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig, useSWRConfig } from 'swr';
import type { UseFormRegister } from 'react-hook-form';
import type { KPI } from '@/types/kpis';
import type { KPIFormData } from '../kpi-form-types';
import { KPIPageComponent } from '../kpi-page';
import { useKPIs, useProgramTags } from '@/hooks/api/useKPIs';
import { mockApiGet, mockApiPut } from '@/test-utils/api';
import { useAuthStore } from '@/stores/authStore';
import { toastError } from '@/lib/toast';
import { createMockKpi } from './kpi-mock-data';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockSearchParams = new URLSearchParams();
let mockRoleCanEdit = true;
const mockMutateMetrics = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/kpis',
  useSearchParams: () => mockSearchParams,
}));

// Keep the direct fetch and SWR cache real; only the unrelated listing is stubbed.
jest.mock('@/hooks/api/useKPIs', () => ({
  ...jest.requireActual('@/hooks/api/useKPIs'),
  useKPIs: jest.fn(),
  useProgramTags: jest.fn(),
}));
jest.mock('@/hooks/api/useMetrics', () => ({
  useMetrics: (): { data: never[]; mutate: typeof mockMutateMetrics } => ({
    data: [],
    mutate: mockMutateMetrics,
  }),
}));
jest.mock('@/hooks/api/useWarehouse', () => ({
  useTableColumns: (): { data: never[] } => ({ data: [] }),
}));
jest.mock('@/lib/rbac', () => ({
  ...jest.requireActual('@/lib/rbac'),
  useRbac: () => ({ hasPermission: () => mockRoleCanEdit }),
}));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { api: jest.fn(), load: jest.fn() },
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/components/ui/docs-link', () => ({
  DocsLink: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// Exercise the real KPI form, including its reset and save lifecycle.
jest.mock('../KpiMetricStep', () => ({ KpiMetricStep: (): null => null }));
jest.mock('../KpiSetupStep', () => ({
  KpiSetupStep: ({ register }: { register: UseFormRegister<KPIFormData> }) => (
    <>
      <input aria-label="KPI name" {...register('name')} />
      <input aria-label="Target" {...register('target_value')} />
    </>
  ),
}));
jest.mock('../KpiThresholdsStep', () => ({ KpiThresholdsStep: (): null => null }));
jest.mock('../kpi-detail-drawer', () => ({
  KPIDetailDrawer: ({ open, kpi }: { open: boolean; kpi: KPI | null }) =>
    open ? <div data-testid="kpi-drawer">Viewing {kpi?.name}</div> : null,
}));
jest.mock('../kpi-delete-dialog', () => ({ KPIDeleteDialog: (): null => null }));
jest.mock('@/components/onboarding/celebration-modal', () => ({
  CelebrationModal: (): null => null,
}));
jest.mock('@/components/alerts/AlertWizardModal', () => ({ AlertWizardModal: (): null => null }));
jest.mock('@/components/ui/share-modal', () => ({ ShareModal: (): null => null }));

function deferredKpi() {
  let resolve!: (kpi: KPI) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<KPI>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderPage(cachedKpi = createMockKpi({ name: 'Old cached name', target_value: 50 })) {
  const cache = new Map([[`/api/kpis/${cachedKpi.id}/`, { data: cachedKpi }]]);
  let mutate!: ReturnType<typeof useSWRConfig>['mutate'];
  function CacheProbe(): null {
    mutate = useSWRConfig().mutate;
    return null;
  }
  const view = render(<KPIPageComponent />, {
    wrapper: ({ children }) => (
      <SWRConfig value={{ provider: () => cache, dedupingInterval: 0, refreshInterval: 0 }}>
        <CacheProbe />
        {children}
      </SWRConfig>
    ),
  });
  return {
    ...view,
    cache,
    updateCache: (kpi: KPI) => mutate(`/api/kpis/${kpi.id}/`, kpi, { revalidate: false }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApiGet.mockReset();
  mockApiPut.mockReset();
  mockRoleCanEdit = true;
  useAuthStore.setState({ selectedOrgSlug: 'org-a', orgUsers: [] });
  jest.mocked(useKPIs).mockReturnValue({
    data: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  jest.mocked(useProgramTags).mockReturnValue({ tags: [], isLoading: false, mutate: jest.fn() });
  mockApiGet.mockResolvedValue(createMockKpi());
});

afterEach(() => useAuthStore.setState({ selectedOrgSlug: null }));

it('fetches an off-page KPI and preserves dashboard return context', async () => {
  mockSearchParams = new URLSearchParams('open=99&from=dashboard');
  renderPage();
  expect(await screen.findByTestId('kpi-drawer')).toHaveTextContent('Viewing Learners reached');
  expect(mockApiGet).toHaveBeenCalledWith(
    '/api/kpis/99/',
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  );
  expect(mockRouter.replace).toHaveBeenCalledWith('/kpis?from=dashboard', { scroll: false });
  fireEvent.click(screen.getByTestId('kpi-back-to-source'));
  expect(mockRouter.back).toHaveBeenCalled();
});

it('waits for fresh data, preserves dirty edits, and refreshes the direct cache after saving', async () => {
  const user = userEvent.setup();
  const request = deferredKpi();
  mockApiGet.mockReturnValueOnce(request.promise);
  mockSearchParams = new URLSearchParams('edit=99&from=report');
  const view = renderPage();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  await act(async () => request.resolve(createMockKpi()));
  expect(await screen.findByLabelText('KPI name')).toHaveValue('Learners reached');
  expect(screen.getByLabelText('Target')).toHaveValue('100');
  expect(mockRouter.replace).toHaveBeenCalledWith('/kpis?from=report', { scroll: false });

  mockSearchParams = new URLSearchParams('from=report');
  view.rerender(<KPIPageComponent />);
  await user.clear(screen.getByLabelText('KPI name'));
  await user.type(screen.getByLabelText('KPI name'), 'Updated locally');
  await act(async () => {
    await view.updateCache(createMockKpi({ name: 'Background update' }));
  });
  expect(screen.getByLabelText('KPI name')).toHaveValue('Updated locally');

  const saved = createMockKpi({ name: 'Updated locally' });
  mockApiPut.mockResolvedValueOnce(saved);
  await user.click(screen.getByTestId('kpi-form-continue-btn'));
  await user.click(await screen.findByRole('button', { name: 'Save KPI' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(mockApiPut).toHaveBeenCalledWith(
    '/api/kpis/99/',
    expect.objectContaining({ name: 'Updated locally', target_value: 100 })
  );
  expect(view.cache.get('/api/kpis/99/')?.data).toEqual(saved);

  mockApiGet.mockResolvedValueOnce(saved);
  mockSearchParams = new URLSearchParams('edit=99&from=report');
  view.rerender(<KPIPageComponent />);
  expect(await screen.findByLabelText('KPI name')).toHaveValue('Updated locally');
  expect(mockApiGet).toHaveBeenCalledTimes(2);
});

it('allows a member with resource edit access to open the editor', async () => {
  mockRoleCanEdit = false;
  mockSearchParams = new URLSearchParams('edit=99&from=report');
  renderPage();
  expect(await screen.findByLabelText('KPI name')).toHaveValue('Learners reached');
});

it.each(['view', undefined] as const)(
  'does not grant edit access from the role when resource access is %s',
  async (access_level) => {
    mockRoleCanEdit = true;
    mockApiGet.mockResolvedValueOnce(createMockKpi({ access_level }));
    mockSearchParams = new URLSearchParams('edit=99');
    renderPage();
    expect(await screen.findByTestId('kpi-drawer')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toastError.api).toHaveBeenCalledWith('You do not have permission to edit this KPI.');
  }
);

it('shows a load error instead of opening stale cached data after a failed fetch', async () => {
  const error = new Error('KPI not found');
  mockApiGet.mockRejectedValueOnce(error);
  mockSearchParams = new URLSearchParams('edit=99&from=report');
  renderPage();
  await waitFor(() => expect(toastError.load).toHaveBeenCalledWith(error, 'KPI'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByTestId('kpi-drawer')).not.toBeInTheDocument();
  expect(mockRouter.replace).toHaveBeenCalledWith('/kpis?from=report', { scroll: false });
});

it('ignores an earlier response after navigating to another KPI', async () => {
  const first = deferredKpi();
  mockApiGet.mockReturnValueOnce(first.promise);
  mockSearchParams = new URLSearchParams('open=99');
  const view = renderPage();
  const signal = mockApiGet.mock.calls[0][1].signal as AbortSignal;
  mockApiGet.mockResolvedValueOnce(createMockKpi({ id: 100, name: 'Second KPI' }));
  mockSearchParams = new URLSearchParams('open=100');
  view.rerender(<KPIPageComponent />);
  expect(await screen.findByTestId('kpi-drawer')).toHaveTextContent('Second KPI');
  await act(async () => first.resolve(createMockKpi()));
  expect(signal.aborted).toBe(true);
  expect(screen.getByTestId('kpi-drawer')).toHaveTextContent('Second KPI');
  expect(mockRouter.replace).toHaveBeenCalledTimes(1);
});

it('ignores an old organization response after switching organizations', async () => {
  const first = deferredKpi();
  mockApiGet.mockReturnValueOnce(first.promise);
  mockSearchParams = new URLSearchParams('open=99');
  const view = renderPage();
  mockApiGet.mockResolvedValueOnce(createMockKpi({ name: 'Org B KPI' }));
  await act(async () => useAuthStore.setState({ selectedOrgSlug: 'org-b' }));
  expect(await screen.findByTestId('kpi-drawer')).toHaveTextContent('Org B KPI');
  await act(async () => first.resolve(createMockKpi()));
  expect(screen.getByTestId('kpi-drawer')).toHaveTextContent('Org B KPI');
  expect(view.cache.get('/api/kpis/99/')?.data.name).toBe('Org B KPI');
});

it('does not open or update the cache after unmounting', async () => {
  const request = deferredKpi();
  mockApiGet.mockReturnValueOnce(request.promise);
  mockSearchParams = new URLSearchParams('edit=99');
  const view = renderPage();
  view.unmount();
  await act(async () => request.resolve(createMockKpi()));
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(view.cache.get('/api/kpis/99/')?.data.name).toBe('Old cached name');
});

it('clears an invalid action without fetching', () => {
  mockSearchParams = new URLSearchParams('edit=bad-id&from=report');
  renderPage();
  expect(mockApiGet).not.toHaveBeenCalled();
  expect(mockRouter.replace).toHaveBeenCalledWith('/kpis?from=report', { scroll: false });
});
