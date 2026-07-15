/**
 * useUserGroups — the single place that talks to /api/groups/*.
 *
 * Backs Settings → Groups (create/rename/delete a group, manage members) and
 * the Groups source in ShareModal's add-principal picker.
 * Contract verified against ddpui/api/groups_api.py + ddpui/schemas/group_schema.py
 * on the paired backend branch (see task-07 report for the verbatim JSON shape).
 */
import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export type GroupMemberStatus = 'active' | 'pending';

export interface GroupCreator {
  orguser_id: number;
  email: string;
  name: string;
}

export interface UserGroup {
  id: number;
  name: string;
  member_count: number;
  shared_resource_count: number;
  // null when the creating OrgUser has since been deleted (created_by is SET_NULL).
  created_by: GroupCreator | null;
  created_at: string;
  // Up to 4 ACTIVE member emails for the avatar stack (Phase A / A2). Only
  // the list endpoint fills this; create/rename/detail return [].
  member_preview: string[];
}

export interface GroupMember {
  id: number;
  orguser_id: number | null;
  email: string | null;
  name: string | null;
  pending_email: string | null;
  status: GroupMemberStatus;
  // The member's org-role slug (e.g. "analyst"), null for pending-email rows
  // that have no OrgUser yet (Phase F5).
  role: string | null;
}

export interface UserGroupDetail extends UserGroup {
  members: GroupMember[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export function groupsKey(enabled: boolean = true): string | null {
  return enabled ? '/api/groups/' : null;
}

export function groupKey(groupId: number | null): string | null {
  return groupId ? `/api/groups/${groupId}/` : null;
}

// `enabled` lets callers that only need the list conditionally (e.g. the
// ShareModal's Groups picker, which shouldn't fetch /api/groups/ for a
// view-only viewer) pass a null SWR key instead of always fetching.
export function useUserGroups(enabled: boolean = true) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<UserGroup[]>>(
    groupsKey(enabled),
    apiGet,
    { revalidateOnFocus: false }
  );

  return {
    data: data?.data,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useUserGroup(groupId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<UserGroupDetail>>(
    groupKey(groupId),
    apiGet,
    { revalidateOnFocus: false }
  );

  return {
    data: data?.data,
    isLoading,
    isError: error,
    mutate,
  };
}

// ---- Mutation functions ----

export interface CreateGroupPayload {
  name: string;
}

export async function createGroup(payload: CreateGroupPayload): Promise<UserGroup> {
  const response: ApiResponse<UserGroup> = await apiPost('/api/groups/', payload);
  return response.data;
}

export interface RenameGroupPayload {
  name: string;
}

export async function renameGroup(
  groupId: number,
  payload: RenameGroupPayload
): Promise<UserGroup> {
  const response: ApiResponse<UserGroup> = await apiPut(`/api/groups/${groupId}/`, payload);
  return response.data;
}

export async function deleteGroup(groupId: number): Promise<void> {
  await apiDelete(`/api/groups/${groupId}/`);
}

export interface AddGroupMemberPayload {
  orguser_id: number;
}

export async function addGroupMember(
  groupId: number,
  payload: AddGroupMemberPayload
): Promise<GroupMember> {
  const response: ApiResponse<GroupMember> = await apiPost(
    `/api/groups/${groupId}/members/`,
    payload
  );
  return response.data;
}

export async function removeGroupMember(groupId: number, memberId: number): Promise<void> {
  await apiDelete(`/api/groups/${groupId}/members/${memberId}/`);
}
