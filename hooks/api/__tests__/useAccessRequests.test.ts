/**
 * useAccessRequests Hook Tests
 *
 * Tests for the /api/access/requests/* sharing hooks and mutation functions:
 * - useAccessRequests: fetches the caller's incoming/outgoing request inbox
 * - createAccessRequest, approveAccessRequest, declineAccessRequest: mutations
 */

import { renderHook, waitFor } from '@testing-library/react';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet, mockApiPost } from '@/test-utils/api';
import {
  useAccessRequests,
  createAccessRequest,
  approveAccessRequest,
  declineAccessRequest,
  type AccessRequestItem,
} from '@/hooks/api/useAccessRequests';

const mockRequest: AccessRequestItem = {
  id: 12,
  resource_type: 'dashboard',
  resource_id: '7',
  requester: { orguser_id: 3, email: 'sarah@ngo.org', name: 'Sarah K' },
  requested_permission: 'view',
  note: 'need this for the board report',
  status: 'pending',
  decided_by: null,
  expires_at: '2026-08-11T09:00:00Z',
  created_at: '2026-07-12T09:00:00Z',
};

describe('useAccessRequests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useAccessRequests(false), { wrapper: TestWrapper });

    expect(result.current.incoming).toEqual([]);
    expect(result.current.outgoing).toEqual([]);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('fetches the incoming/outgoing inbox when enabled', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: { incoming: [mockRequest], outgoing: [] },
    });

    const { result } = renderHook(() => useAccessRequests(true), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.incoming).toEqual([mockRequest]);
    });
    expect(mockApiGet).toHaveBeenCalledWith('/api/access/requests/');
  });
});

describe('Mutation functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAccessRequest', () => {
    it('posts a new access request', async () => {
      mockApiPost.mockResolvedValue({ success: true, data: mockRequest });

      const result = await createAccessRequest('dashboard', 7, {
        requested_permission: 'view',
        note: 'need this for the board report',
      });

      expect(result).toEqual(mockRequest);
      expect(mockApiPost).toHaveBeenCalledWith('/api/access/dashboard/7/requests/', {
        requested_permission: 'view',
        note: 'need this for the board report',
      });
    });
  });

  describe('approveAccessRequest', () => {
    it('posts with no body to grant exactly what was requested', async () => {
      mockApiPost.mockResolvedValue({
        success: true,
        data: { ...mockRequest, status: 'approved' },
      });

      await approveAccessRequest(12);

      expect(mockApiPost).toHaveBeenCalledWith('/api/access/requests/12/approve/', {});
    });

    it('posts the downgraded permission when the owner picks a lower level', async () => {
      mockApiPost.mockResolvedValue({
        success: true,
        data: { ...mockRequest, status: 'approved' },
      });

      await approveAccessRequest(12, 'view');

      expect(mockApiPost).toHaveBeenCalledWith('/api/access/requests/12/approve/', {
        permission: 'view',
      });
    });
  });

  describe('declineAccessRequest', () => {
    it('posts to the decline endpoint with no body', async () => {
      mockApiPost.mockResolvedValue({
        success: true,
        data: { ...mockRequest, status: 'declined' },
      });

      await declineAccessRequest(12);

      expect(mockApiPost).toHaveBeenCalledWith('/api/access/requests/12/decline/', {});
    });
  });
});
