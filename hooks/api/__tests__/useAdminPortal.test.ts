/**
 * Tests for the feature-flags slice of useAdminPortal.ts (Milestone 3: per-org and
 * multi-org on/off). The org/user hooks in this file are covered elsewhere; this file
 * is scoped to the new flag catalog / per-org read / set / clear / bulk-set surface.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet, mockApiPut, mockApiDelete, resetApiMocks } from '@/test-utils/api';
import {
  useAdminFlagCatalog,
  useAdminOrgFlags,
  useAdminFlagActions,
} from '@/hooks/api/useAdminPortal';

beforeEach(() => {
  resetApiMocks();
});

describe('useAdminFlagCatalog', () => {
  it('reads the fixed flag registry from /api/v1/admin/flags/catalog', async () => {
    mockApiGet.mockResolvedValueOnce([{ flag_name: 'REPORTS', description: 'Enable reports' }]);

    const { result } = renderHook(() => useAdminFlagCatalog(), { wrapper: TestWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/admin/flags/catalog');
    expect(result.current.catalog).toEqual([
      { flag_name: 'REPORTS', description: 'Enable reports' },
    ]);
  });
});

describe('useAdminOrgFlags', () => {
  it("reads one org's flags from /api/v1/admin/orgs/{id}/flags", async () => {
    mockApiGet.mockResolvedValueOnce({ REPORTS: true, DATA_QUALITY: false });

    const { result } = renderHook(() => useAdminOrgFlags(7), { wrapper: TestWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/admin/orgs/7/flags');
    expect(result.current.flags).toEqual({ REPORTS: true, DATA_QUALITY: false });
  });

  it('skips the request when orgId is null', () => {
    renderHook(() => useAdminOrgFlags(null), { wrapper: TestWrapper });
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe('useAdminFlagActions', () => {
  it('setOrgFlag PUTs {enabled} to the single-org route and returns the updated flags', async () => {
    mockApiPut.mockResolvedValueOnce({ REPORTS: true });
    const { result } = renderHook(() => useAdminFlagActions(), { wrapper: TestWrapper });

    const flags = await act(() => result.current.setOrgFlag(7, 'REPORTS', true));

    expect(mockApiPut).toHaveBeenCalledWith('/api/v1/admin/orgs/7/flags/REPORTS', {
      enabled: true,
    });
    expect(flags).toEqual({ REPORTS: true });
  });

  it('clearOrgFlag DELETEs the org override and returns the fallen-back flags', async () => {
    mockApiDelete.mockResolvedValueOnce({ REPORTS: false });
    const { result } = renderHook(() => useAdminFlagActions(), { wrapper: TestWrapper });

    const flags = await act(() => result.current.clearOrgFlag(7, 'REPORTS'));

    expect(mockApiDelete).toHaveBeenCalledWith('/api/v1/admin/orgs/7/flags/REPORTS');
    expect(flags).toEqual({ REPORTS: false });
  });

  it('bulkSetFlag PUTs {org_ids, enabled} to the bulk route and returns per-org results', async () => {
    mockApiPut.mockResolvedValueOnce([
      { org_id: 7, success: true },
      { org_id: 8, success: false },
    ]);
    const { result } = renderHook(() => useAdminFlagActions(), { wrapper: TestWrapper });

    const results = await act(() => result.current.bulkSetFlag('REPORTS', [7, 8], true));

    expect(mockApiPut).toHaveBeenCalledWith('/api/v1/admin/flags/REPORTS/orgs', {
      org_ids: [7, 8],
      enabled: true,
    });
    expect(results).toEqual([
      { org_id: 7, success: true },
      { org_id: 8, success: false },
    ]);
  });
});
