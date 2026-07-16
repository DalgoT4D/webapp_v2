/**
 * useUserGroups — the single place that talks to /api/groups/*. Backs
 * Settings → Groups and ShareModal's Groups picker; types mirror the
 * backend's group_schema.py.
 */
import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type { InviteRoleSlug } from '@/hooks/api/useResourceAccess';

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
  // Up to 4 active member emails for the avatar stack. Only the list
  // endpoint fills this; create/rename/detail return [].
  member_preview: string[];
}

export interface GroupMember {
  id: number;
  orguser_id: number | null;
  email: string | null;
  name: string | null;
  pending_email: string | null;
  status: GroupMemberStatus;
  // The member's org-role slug (e.g. "analyst"); null for pending-email
  // rows that have no OrgUser yet.
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

// `enabled` lets conditional callers (e.g. ShareModal for a view-only
// viewer) pass a null SWR key instead of always fetching.
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

/** One-off (non-SWR) group-detail fetch — resolves a staged group's current
 * active members at submit time; no fixed set of ids to subscribe to. */
export async function fetchGroupDetail(groupId: number): Promise<UserGroupDetail> {
  const response: ApiResponse<UserGroupDetail> = await apiGet(`/api/groups/${groupId}/`);
  return response.data;
}

export async function deleteGroup(groupId: number): Promise<void> {
  await apiDelete(`/api/groups/${groupId}/`);
}

// Exactly one of orguser_id/email. `invite_role` is only used on the
// unknown-email path and stages a pending row that activates on signup.
export type AddGroupMemberPayload =
  | { orguser_id: number; email?: never; invite_role?: never }
  | { orguser_id?: never; email: string; invite_role?: InviteRoleSlug };

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
