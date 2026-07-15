/**
 * useUserGroups Hook Tests
 *
 * Tests for the /api/groups/* hooks and mutation functions:
 * - useUserGroups: list of this org's groups (member/shared-resource counts)
 * - useUserGroup: one group + its members
 * - createGroup, renameGroup, deleteGroup, addGroupMember, removeGroupMember: mutations
 */

import { renderHook, waitFor } from '@testing-library/react';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet, mockApiPost, mockApiPut, mockApiDelete } from '@/test-utils/api';
import {
  useUserGroups,
  useUserGroup,
  createGroup,
  renameGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  type UserGroup,
  type UserGroupDetail,
} from '@/hooks/api/useUserGroups';

const mockGroup: UserGroup = {
  id: 1,
  name: 'Funders',
  member_count: 2,
  shared_resource_count: 3,
  created_by: { orguser_id: 5, email: 'asha@ngo.org', name: 'Asha Kumar' },
  created_at: '2026-01-01T00:00:00Z',
  member_preview: ['asha@ngo.org', 'meera@ngo.org'],
};

const mockGroupDetail: UserGroupDetail = {
  ...mockGroup,
  members: [
    {
      id: 10,
      orguser_id: 5,
      email: 'asha@ngo.org',
      name: 'Asha Kumar',
      pending_email: null,
      status: 'active',
      role: 'analyst',
    },
    {
      id: 11,
      orguser_id: 6,
      email: 'meera@ngo.org',
      name: 'Meera Das',
      pending_email: null,
      status: 'active',
      role: 'member',
    },
  ],
};

describe('useUserGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the org groups list', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: [mockGroup] });

    const { result } = renderHook(() => useUserGroups(), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual([mockGroup]);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/api/groups/');
  });

  it('does not fetch when disabled (e.g. a view-only ShareModal viewer)', () => {
    const { result } = renderHook(() => useUserGroups(false), { wrapper: TestWrapper });

    expect(result.current.data).toBeUndefined();
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe('useUserGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not fetch when groupId is null', () => {
    const { result } = renderHook(() => useUserGroup(null), { wrapper: TestWrapper });

    expect(result.current.data).toBeUndefined();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('fetches one group with its members', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: mockGroupDetail });

    const { result } = renderHook(() => useUserGroup(1), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockGroupDetail);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/api/groups/1/');
  });
});

describe('Mutation functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createGroup', () => {
    it('posts a new group and returns it', async () => {
      mockApiPost.mockResolvedValue({ success: true, data: mockGroup });

      const result = await createGroup({ name: 'Funders' });

      expect(result).toEqual(mockGroup);
      expect(mockApiPost).toHaveBeenCalledWith('/api/groups/', { name: 'Funders' });
    });
  });

  describe('renameGroup', () => {
    it('puts the new name and returns the updated group', async () => {
      const renamed = { ...mockGroup, name: 'Major Funders' };
      mockApiPut.mockResolvedValue({ success: true, data: renamed });

      const result = await renameGroup(1, { name: 'Major Funders' });

      expect(result).toEqual(renamed);
      expect(mockApiPut).toHaveBeenCalledWith('/api/groups/1/', { name: 'Major Funders' });
    });
  });

  describe('deleteGroup', () => {
    it('deletes a group', async () => {
      mockApiDelete.mockResolvedValue({ success: true, message: 'Group deleted' });

      await deleteGroup(1);

      expect(mockApiDelete).toHaveBeenCalledWith('/api/groups/1/');
    });
  });

  describe('addGroupMember', () => {
    it('posts a new member and returns it', async () => {
      const newMember = mockGroupDetail.members[1];
      mockApiPost.mockResolvedValue({ success: true, data: newMember });

      const result = await addGroupMember(1, { orguser_id: 6 });

      expect(result).toEqual(newMember);
      expect(mockApiPost).toHaveBeenCalledWith('/api/groups/1/members/', { orguser_id: 6 });
    });
  });

  describe('removeGroupMember', () => {
    it('deletes a membership row', async () => {
      mockApiDelete.mockResolvedValue({ success: true, message: 'Member removed' });

      await removeGroupMember(1, 11);

      expect(mockApiDelete).toHaveBeenCalledWith('/api/groups/1/members/11/');
    });
  });
});
