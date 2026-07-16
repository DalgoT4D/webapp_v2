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
  transferOwnership,
  bulkApplyAccess,
  type ResourceAccessOverview,
} from '@/hooks/api/useResourceAccess';

const mockOverview: ResourceAccessOverview = {
  resource_type: 'dashboard',
  resource_id: '1',
  capabilities: { general: true, grants: true, public_link: true, requests: true },
  owner: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
  general_access: { analyst_level: 'edit', member_level: 'view' },
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
    // v1.1 M3b: the grant-create response envelope moved the grant to
    // `data.grant` (alongside the confirmation fields) — a bare
    // `response.data` is no longer the grant itself.
    it('posts a new grant and returns the GrantCreateResult envelope (new shape)', async () => {
      const mockGrant = mockOverview.grants[0];
      mockApiPost.mockResolvedValue({
        success: true,
        data: { requires_confirmation: false, under_covering_charts: [], grant: mockGrant },
      });

      const result = await addGrant('dashboard', 1, {
        principal_type: 'user',
        principal_id: 3,
        permission: 'view',
      });

      expect(result.requires_confirmation).toBe(false);
      expect(result.grant).toEqual(mockGrant);
      expect(mockApiPost).toHaveBeenCalledWith('/api/access/dashboard/1/grants/', {
        principal_type: 'user',
        principal_id: 3,
        permission: 'view',
      });
    });

    // Old-shape absence: the function must NOT treat the raw response.data
    // as the grant — a naive `response.data as AccessGrant` read would make
    // `result.id`/`result.permission` defined even though this file no
    // longer awaits that shape from the backend.
    it('does not read the response envelope itself as the grant (old shape gone)', async () => {
      const mockGrant = mockOverview.grants[0];
      mockApiPost.mockResolvedValue({
        success: true,
        data: { requires_confirmation: false, under_covering_charts: [], grant: mockGrant },
      });

      const result = await addGrant('dashboard', 1, {
        principal_type: 'user',
        principal_id: 3,
        permission: 'view',
      });

      expect((result as unknown as { id?: number }).id).toBeUndefined();
      expect((result as unknown as { permission?: string }).permission).toBeUndefined();
    });

    it('surfaces requires_confirmation with the under-covering charts named, grant null (nothing written)', async () => {
      mockApiPost.mockResolvedValue({
        success: true,
        data: {
          requires_confirmation: true,
          under_covering_charts: [
            {
              chart_id: 7,
              title: 'Salary Breakdown',
              covered: false,
              role_gaps: [],
              principal_gaps: [
                {
                  principal_type: 'group',
                  principal_id: 4,
                  name: 'Funders',
                  email: null,
                  skipped_member: false,
                },
              ],
              public_exposure: false,
              extendable: true,
              viewer_can_edit: true,
            },
          ],
          grant: null,
        },
      });

      const result = await addGrant('dashboard', 1, {
        principal_type: 'group',
        principal_id: 4,
        permission: 'view',
      });

      expect(result.requires_confirmation).toBe(true);
      expect(result.grant).toBeNull();
      expect(result.under_covering_charts).toHaveLength(1);
      expect(result.under_covering_charts[0].title).toBe('Salary Breakdown');
    });

    it('re-sends with extend_chart_ids and/or proceed to commit after confirmation', async () => {
      const mockGrant = mockOverview.grants[0];
      mockApiPost.mockResolvedValue({
        success: true,
        data: { requires_confirmation: false, under_covering_charts: [], grant: mockGrant },
      });

      await addGrant('dashboard', 1, {
        principal_type: 'group',
        principal_id: 4,
        permission: 'view',
        extend_chart_ids: [7],
        proceed: true,
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/access/dashboard/1/grants/', {
        principal_type: 'group',
        principal_id: 4,
        permission: 'view',
        extend_chart_ids: [7],
        proceed: true,
      });
    });
  });

  describe('addGrant — email invite path', () => {
    it('posts a grant with email instead of principal_id', async () => {
      const pendingGrant = mockOverview.grants[1];
      mockApiPost.mockResolvedValue({
        success: true,
        data: { requires_confirmation: false, under_covering_charts: [], grant: pendingGrant },
      });

      const result = await addGrant('dashboard', 1, {
        principal_type: 'user',
        email: 'new.person@ngo.org',
        permission: 'view',
      });

      expect(result.grant).toEqual(pendingGrant);
      expect(mockApiPost).toHaveBeenCalledWith('/api/access/dashboard/1/grants/', {
        principal_type: 'user',
        email: 'new.person@ngo.org',
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
          general_access: { analyst_level: 'edit', member_level: 'view' },
        },
      });

      const result = await setGeneralAccess('dashboard', 1, {
        analyst_level: 'edit',
        member_level: 'view',
      });

      expect(result.requires_confirmation).toBe(false);
      expect(result.general_access).toEqual({ analyst_level: 'edit', member_level: 'view' });
      expect(mockApiPut).toHaveBeenCalledWith('/api/access/dashboard/1/general/', {
        analyst_level: 'edit',
        member_level: 'view',
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
        analyst_level: 'view',
        member_level: 'none',
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
          general_access: { analyst_level: 'view', member_level: 'none' },
        },
      });

      await setGeneralAccess('dashboard', 1, {
        analyst_level: 'view',
        member_level: 'none',
        remove_grant_ids: [],
      });

      expect(mockApiPut).toHaveBeenCalledWith('/api/access/dashboard/1/general/', {
        analyst_level: 'view',
        member_level: 'none',
        remove_grant_ids: [],
      });
    });
  });

  describe('transferOwnership', () => {
    it('posts the new owner orguser id and returns the new owner', async () => {
      const newOwner = { orguser_id: 42, email: 'priya@ngo.org', name: 'Priya Sharma' };
      mockApiPost.mockResolvedValue({
        success: true,
        data: newOwner,
        message: 'Ownership transferred',
      });

      const result = await transferOwnership('dashboard', 1, 42);

      expect(result).toEqual(newOwner);
      expect(mockApiPost).toHaveBeenCalledWith('/api/access/dashboard/1/owner/', {
        new_owner_orguser_id: 42,
      });
    });
  });

  describe('bulkApplyAccess', () => {
    it('posts the bulk request and returns the unwrapped response', async () => {
      mockApiPost.mockResolvedValue({
        success: true,
        data: {
          applied: [{ rtype: 'dashboard', id: '1' }],
          skipped: [{ rtype: 'dashboard', id: '2', reason: 'edit_access_denied' }],
          requires_confirmation: [],
          applied_count: 1,
          skipped_count: 1,
        },
      });

      const result = await bulkApplyAccess({
        items: [
          { rtype: 'dashboard', id: '1' },
          { rtype: 'dashboard', id: '2' },
        ],
        action: 'add_grant',
        add_grant: { principal_type: 'user', principal_id: 9, permission: 'view' },
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/access/bulk/', {
        items: [
          { rtype: 'dashboard', id: '1' },
          { rtype: 'dashboard', id: '2' },
        ],
        action: 'add_grant',
        add_grant: { principal_type: 'user', principal_id: 9, permission: 'view' },
      });
      expect(result.applied).toEqual([{ rtype: 'dashboard', id: '1' }]);
      expect(result.skipped).toEqual([
        { rtype: 'dashboard', id: '2', reason: 'edit_access_denied' },
      ]);
      expect(result.applied_count).toBe(1);
      expect(result.skipped_count).toBe(1);
    });

    it('surfaces requires_confirmation items with persisting_grants (set_general narrowing)', async () => {
      mockApiPost.mockResolvedValue({
        success: true,
        data: {
          applied: [],
          skipped: [],
          requires_confirmation: [
            { rtype: 'dashboard', id: '1', persisting_grants: [mockOverview.grants[0]] },
          ],
          applied_count: 0,
          skipped_count: 0,
        },
      });

      const result = await bulkApplyAccess({
        items: [{ rtype: 'dashboard', id: '1' }],
        action: 'set_general',
        set_general: { analyst_level: 'none', member_level: 'none' },
      });

      expect(result.requires_confirmation).toEqual([
        { rtype: 'dashboard', id: '1', persisting_grants: [mockOverview.grants[0]] },
      ]);
    });

    it('re-sends with a flat remove_grant_ids list to commit after confirmation', async () => {
      mockApiPost.mockResolvedValue({
        success: true,
        data: {
          applied: [{ rtype: 'dashboard', id: '1' }],
          skipped: [],
          requires_confirmation: [],
          applied_count: 1,
          skipped_count: 0,
        },
      });

      await bulkApplyAccess({
        items: [{ rtype: 'dashboard', id: '1' }],
        action: 'set_general',
        set_general: { analyst_level: 'none', member_level: 'none', remove_grant_ids: [3] },
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/access/bulk/', {
        items: [{ rtype: 'dashboard', id: '1' }],
        action: 'set_general',
        set_general: { analyst_level: 'none', member_level: 'none', remove_grant_ids: [3] },
      });
    });

    it('posts a toggle_public bulk request', async () => {
      mockApiPost.mockResolvedValue({
        success: true,
        data: {
          applied: [{ rtype: 'dashboard', id: '1' }],
          skipped: [{ rtype: 'alert', id: '2', reason: 'public_link_not_supported' }],
          requires_confirmation: [],
          applied_count: 1,
          skipped_count: 1,
        },
      });

      const result = await bulkApplyAccess({
        items: [
          { rtype: 'dashboard', id: '1' },
          { rtype: 'alert', id: '2' },
        ],
        action: 'toggle_public',
        toggle_public: { is_public: true },
      });

      expect(result.skipped[0].reason).toBe('public_link_not_supported');
    });
  });
});
