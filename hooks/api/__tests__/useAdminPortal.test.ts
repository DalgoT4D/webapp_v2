/**
 * Tests for the feature-flags slice of useAdminPortal.ts (Milestone 3: per-org and
 * multi-org on/off). The org/user hooks in this file are covered elsewhere; this file
 * is scoped to the new flag catalog / per-org read / set / clear / bulk-set surface.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { TestWrapper } from '@/test-utils/render';
import {
  mockApiGet,
  mockApiPost,
  mockApiPut,
  mockApiDelete,
  resetApiMocks,
} from '@/test-utils/api';
import {
  useAdminFlagCatalog,
  useAdminOrgFlags,
  useAdminFlagActions,
  useAdminNotifications,
  useAdminNotificationActions,
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

describe('useAdminNotifications', () => {
  it('reads broadcast history from /api/v1/admin/notifications', async () => {
    mockApiGet.mockResolvedValueOnce([
      {
        id: 1,
        message: 'hello',
        urgent: false,
        timestamp: '2026-08-24T00:00:00Z',
        sent_time: '2026-08-24T00:00:01Z',
        target_org_names: ['Akshara'],
        send_in_app: true,
        send_email: true,
        recipient_count: 3,
      },
    ]);

    const { result } = renderHook(() => useAdminNotifications(), { wrapper: TestWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/admin/notifications');
    expect(result.current.notifications).toEqual([
      expect.objectContaining({ id: 1, recipient_count: 3, target_org_names: ['Akshara'] }),
    ]);
  });
});

describe('useAdminNotificationActions', () => {
  it('previewRecipients POSTs {org_ids} to the preview route and returns the count', async () => {
    mockApiPost.mockResolvedValueOnce({ recipient_count: 87 });
    const { result } = renderHook(() => useAdminNotificationActions(), { wrapper: TestWrapper });

    const preview = await act(() => result.current.previewRecipients([7, 8]));

    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/admin/notifications/preview', {
      org_ids: [7, 8],
    });
    expect(preview).toEqual({ recipient_count: 87 });
  });

  it('sendNotification POSTs the broadcast payload and returns the created notification', async () => {
    mockApiPost.mockResolvedValueOnce({
      id: 1,
      message: 'hello',
      urgent: false,
      timestamp: '2026-08-24T00:00:00Z',
      sent_time: '2026-08-24T00:00:01Z',
      target_org_names: ['Akshara'],
      send_in_app: true,
      send_email: false,
      recipient_count: 3,
    });
    const { result } = renderHook(() => useAdminNotificationActions(), { wrapper: TestWrapper });

    const sent = await act(() =>
      result.current.sendNotification({
        message: 'hello',
        email_subject: 'subject',
        org_ids: [7],
        send_in_app: true,
        send_email: false,
      })
    );

    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/admin/notifications', {
      message: 'hello',
      email_subject: 'subject',
      org_ids: [7],
      send_in_app: true,
      send_email: false,
    });
    expect(sent.recipient_count).toBe(3);
  });
});
