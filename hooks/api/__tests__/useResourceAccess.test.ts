/**
 * useResourceAccess Hook Tests
 *
 * Tests for the /api/access/* sharing hooks and mutation functions:
 * - useResourceAccess: fetches the access overview for a shareable resource
 * - addGrant, removeGrant, setGeneralAccess: mutations
 */

import { renderHook, waitFor } from '@testing-library/react';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet, mockApiPost, mockApiPut, mockApiDelete } from '@/test-utils/api';
import {
  useResourceAccess,
  addGrant,
  removeGrant,
  setGeneralAccess,
  type ResourceAccessOverview,
} from '@/hooks/api/useResourceAccess';

const mockOverview: ResourceAccessOverview = {
  resource_type: 'dashboard',
  resource_id: '1',
  capabilities: { general: true, grants: true, public_link: true, requests: true },
  owner: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
  general_access: { audience: 'analysts_plus', level: 'view' },
  grants: [
    {
      id: 1,
      principal_type: 'user',
      principal_id: 3,
      email: 'meera@ngo.org',
      name: 'Meera Das',
      permission: 'view',
      status: 'active',
    },
    {
      id: 2,
      principal_type: 'user',
      principal_id: null,
      email: 'new.person@ngo.org',
      name: null,
      permission: 'view',
      status: 'pending',
    },
  ],
  viewer: { effective_permission: 'edit', is_owner: false },
};

describe('useResourceAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not fetch when rtype is null', () => {
    const { result } = renderHook(() => useResourceAccess(null, 1), { wrapper: TestWrapper });

    expect(result.current.data).toBeUndefined();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('does not fetch when resourceId is null', () => {
    const { result } = renderHook(() => useResourceAccess('dashboard', null), {
      wrapper: TestWrapper,
    });

    expect(result.current.data).toBeUndefined();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('fetches the access overview for a resource', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: mockOverview });

    const { result } = renderHook(() => useResourceAccess('dashboard', 1), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockOverview);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/api/access/dashboard/1/');
  });
});

describe('Mutation functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addGrant', () => {
    it('posts a new grant and returns the created grant', async () => {
      const mockGrant = mockOverview.grants[0];
      mockApiPost.mockResolvedValue({ success: true, data: mockGrant });

      const result = await addGrant('dashboard', 1, {
        principal_type: 'user',
        principal_id: 3,
        permission: 'view',
      });

      expect(result).toEqual(mockGrant);
      expect(mockApiPost).toHaveBeenCalledWith('/api/access/dashboard/1/grants/', {
        principal_type: 'user',
        principal_id: 3,
        permission: 'view',
      });
    });
  });

  describe('removeGrant', () => {
    it('deletes a grant', async () => {
      mockApiDelete.mockResolvedValue({ success: true, message: 'Access revoked' });

      await removeGrant('dashboard', 1, 3);

      expect(mockApiDelete).toHaveBeenCalledWith('/api/access/dashboard/1/grants/3/');
    });
  });

  describe('setGeneralAccess', () => {
    it('puts the new general access setting and returns the committed result', async () => {
      mockApiPut.mockResolvedValue({
        success: true,
        data: {
          requires_confirmation: false,
          persisting_grants: [],
          general_access: { audience: 'all_users', level: 'view' },
        },
      });

      const result = await setGeneralAccess('dashboard', 1, {
        audience: 'all_users',
        level: 'view',
      });

      expect(result.requires_confirmation).toBe(false);
      expect(result.general_access).toEqual({ audience: 'all_users', level: 'view' });
      expect(mockApiPut).toHaveBeenCalledWith('/api/access/dashboard/1/general/', {
        audience: 'all_users',
        level: 'view',
      });
    });

    it('surfaces requires_confirmation with persisting_grants on narrowing', async () => {
      mockApiPut.mockResolvedValue({
        success: true,
        data: {
          requires_confirmation: true,
          persisting_grants: [mockOverview.grants[0]],
          general_access: null,
        },
      });

      const result = await setGeneralAccess('dashboard', 1, {
        audience: 'private',
        level: 'view',
      });

      expect(result.requires_confirmation).toBe(true);
      expect(result.persisting_grants).toEqual([mockOverview.grants[0]]);
    });

    it('re-sends with remove_grant_ids to commit after confirmation', async () => {
      mockApiPut.mockResolvedValue({
        success: true,
        data: {
          requires_confirmation: false,
          persisting_grants: [],
          general_access: { audience: 'private', level: 'view' },
        },
      });

      await setGeneralAccess('dashboard', 1, {
        audience: 'private',
        level: 'view',
        remove_grant_ids: [],
      });

      expect(mockApiPut).toHaveBeenCalledWith('/api/access/dashboard/1/general/', {
        audience: 'private',
        level: 'view',
        remove_grant_ids: [],
      });
    });
  });
});
