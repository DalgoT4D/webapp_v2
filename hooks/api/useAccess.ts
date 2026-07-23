import useSWR from 'swr';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/lib/api';
import { toast } from 'sonner';
import type { PersonRow } from '@/types/user-management';
import type {
  GroupListRow,
  GroupDetail,
  CreateGroupPayload,
  AddMembersPayload,
} from '@/types/user-groups';
import type { ShareRow, AddGrantsPayload, UpdateGrantPayload, AccessLevel } from '@/types/access';

export function usePeople() {
  const { data, error, isLoading, mutate } = useSWR<PersonRow[]>(
    '/api/v1/organizations/people',
    apiGet
  );

  return {
    people: data,
    isLoading,
    error,
    mutate,
  };
}

export function useUserGroups() {
  const { data, error, isLoading, mutate } = useSWR<GroupListRow[]>(
    '/api/v1/organizations/user_groups',
    apiGet
  );

  return {
    groups: data,
    isLoading,
    error,
    mutate,
  };
}

export function useUserGroup(groupId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<GroupDetail>(
    groupId != null ? `/api/v1/organizations/user_groups/${groupId}` : null,
    apiGet
  );

  return {
    group: data,
    isLoading,
    error,
    mutate,
  };
}

export function useUserGroupActions() {
  const createGroup = async (payload: CreateGroupPayload): Promise<GroupDetail> => {
    try {
      const res = await (apiPost as any)('/api/v1/organizations/user_groups', payload);
      toast.success('Group created');
      return res;
    } catch (error: any) {
      toast.error(error.message || 'Failed to create group');
      throw error;
    }
  };

  const renameGroup = async (groupId: number, name: string): Promise<GroupDetail> => {
    try {
      const res = (await apiPatch(`/api/v1/organizations/user_groups/${groupId}`, {
        name,
      })) as GroupDetail;
      toast.success('Group renamed');
      return res;
    } catch (error: any) {
      toast.error(error.message || 'Failed to rename group');
      throw error;
    }
  };

  const deleteGroup = async (groupId: number): Promise<void> => {
    try {
      await apiDelete(`/api/v1/organizations/user_groups/${groupId}`);
      toast.success('Group deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete group');
      throw error;
    }
  };

  const addMembers = async (groupId: number, payload: AddMembersPayload): Promise<GroupDetail> => {
    try {
      const res = await (apiPost as any)(
        `/api/v1/organizations/user_groups/${groupId}/members`,
        payload
      );
      toast.success('Members added');
      return res;
    } catch (error: any) {
      toast.error(error.message || 'Failed to add members');
      throw error;
    }
  };

  const removeMember = async (groupId: number, memberId: number): Promise<void> => {
    try {
      await apiDelete(`/api/v1/organizations/user_groups/${groupId}/members/${memberId}`);
      toast.success('Member removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member');
      throw error;
    }
  };

  return { createGroup, renameGroup, deleteGroup, addMembers, removeMember };
}

export interface AccessDefaults {
  default_analyst_level: 'view' | 'edit' | 'no_access';
  default_member_level: 'view' | 'edit' | 'no_access';
  allow_public_sharing: boolean;
}

export function useResourceGrants(rtype: string | null, resourceId: number | string | null) {
  const key = rtype && resourceId != null ? `/api/access/${rtype}/${resourceId}/grants` : null;
  const { data, error, isLoading, mutate } = useSWR<ShareRow[]>(key, apiGet);
  return { shares: data, isLoading, error, mutate };
}

export function useResourceGrantActions(rtype: string, resourceId: number | string) {
  const base = `/api/access/${rtype}/${resourceId}/grants`;

  const addGrants = async (payload: AddGrantsPayload): Promise<ShareRow[]> => {
    try {
      const res = (await (apiPost as any)(base, payload)) as ShareRow[];
      toast.success('Sharing updated');
      return res;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update sharing');
      throw error;
    }
  };

  const updateGrant = async (shareId: number, accessLevel: AccessLevel): Promise<ShareRow[]> => {
    try {
      const res = (await apiPatch(`${base}/${shareId}`, {
        access_level: accessLevel,
      } satisfies UpdateGrantPayload)) as ShareRow[];
      return res;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to change access level');
      throw error;
    }
  };

  const removeGrant = async (shareId: number): Promise<ShareRow[]> => {
    try {
      const res = (await apiDelete(`${base}/${shareId}`)) as ShareRow[];
      return res;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove access');
      throw error;
    }
  };

  return { addGrants, updateGrant, removeGrant };
}

export async function updateAccessDefaults(payload: AccessDefaults) {
  try {
    await apiPut('/api/orgpreferences/access-defaults', payload);
    toast.success('Access defaults saved');
    return true;
  } catch (error: any) {
    toast.error(error?.message || 'Failed to save access defaults');
    throw error;
  }
}
