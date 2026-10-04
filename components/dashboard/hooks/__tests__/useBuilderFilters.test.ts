import { act, renderHook } from '@testing-library/react';
import { apiPost, apiPut } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { useBuilderFilters } from '@/components/dashboard/hooks/useBuilderFilters';
import { DashboardFilterType, type DashboardFilterConfig } from '@/types/dashboard-filters';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockSwrMutate = jest.fn();
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: (...a: unknown[]) => mockSwrMutate(...a),
}));

const mockApiPost = apiPost as jest.Mock;
const mockApiPut = apiPut as jest.Mock;

const payload = {
  name: 'State',
  schema_name: 'public',
  table_name: 'sales',
  column_name: 'state',
  filter_type: DashboardFilterType.VALUE,
  settings: { has_default_value: false, can_select_multiple: true },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('useBuilderFilters', () => {
  it('create: POSTs the six fields, tracks, closes the modal, revalidates the dashboard', async () => {
    mockApiPost.mockResolvedValue({ id: 9 });
    const { result } = renderHook(() => useBuilderFilters(7));
    act(() => result.current.openFilterModal());
    await act(async () => {
      await result.current.handleFilterSave(payload);
    });
    expect(mockApiPost).toHaveBeenCalledWith('/api/dashboards/7/filters/', payload);
    expect(trackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.DASHBOARD_FILTER_CREATED, {
      dashboard_id: 7,
      filter_type: 'value',
    });
    expect(result.current.showFilterModal).toBe(false);
    expect(mockSwrMutate).toHaveBeenCalledWith('/api/dashboards/7/');
  });

  it('create failure is silent: logged only, modal state unchanged (pinned)', async () => {
    mockApiPost.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useBuilderFilters(7));
    act(() => result.current.openFilterModal());
    await act(async () => {
      await result.current.handleFilterSave(payload);
    });
    expect(console.error).toHaveBeenCalledWith('Failed to create filter:', 'boom');
    expect(trackEvent).not.toHaveBeenCalled();
    expect(result.current.showFilterModal).toBe(true);
  });

  it('edit: opens with the filter (numeric id, order 0), PUTs with the old type as fallback', async () => {
    mockApiPut.mockResolvedValue({});
    const { result } = renderHook(() => useBuilderFilters(7));
    const config = {
      id: '5',
      name: 'State',
      schema_name: 'public',
      table_name: 'sales',
      column_name: 'state',
      filter_type: DashboardFilterType.NUMERICAL,
      settings: { ui_mode: 'slider' },
      position: { x: 0, y: 0, w: 4, h: 3 },
    } as DashboardFilterConfig;
    act(() => result.current.handleEditFilter(config));
    expect(result.current.showFilterModal).toBe(true);
    expect(result.current.selectedFilterForEdit).toMatchObject({
      id: 5,
      dashboard_id: 7,
      order: 0,
    });

    await act(async () => {
      await result.current.handleFilterSave({ name: 'Region', settings: payload.settings }, 5);
    });
    expect(mockApiPut).toHaveBeenCalledWith('/api/dashboards/7/filters/5/', {
      name: 'Region',
      schema_name: undefined,
      table_name: undefined,
      column_name: undefined,
      filter_type: 'numerical',
      settings: payload.settings,
    });
    expect(result.current.selectedFilterForEdit).toBeNull();
    expect(result.current.showFilterModal).toBe(false);
  });

  it('close resets both pieces of modal state', () => {
    const { result } = renderHook(() => useBuilderFilters(7));
    act(() => result.current.openFilterModal());
    act(() => result.current.closeFilterModal());
    expect(result.current.showFilterModal).toBe(false);
    expect(result.current.selectedFilterForEdit).toBeNull();
  });
});
