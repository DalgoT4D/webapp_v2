/**
 * useResourceAccess — the single place that talks to /api/access/*.
 *
 * Backs the ShareModal "People with access" / "General access" sections.
 * Contract verified against ddpui/api/access_api.py + ddpui/schemas/access_schema.py
 * on the paired backend branch (see task-05 report for the verbatim JSON shape).
 */
import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

// Mirrors ddpui/core/sharing/shareable_types.py — the rtypes with a registry entry.
export type ShareableResourceType = 'dashboard' | 'report' | 'alert' | 'metric' | 'kpi';

export type AccessAudience = 'private' | 'admins' | 'analysts_plus' | 'all_users';
export type AccessLevel = 'view' | 'edit';
export type PrincipalType = 'user' | 'group';
export type GrantStatus = 'active' | 'pending';

export interface AccessCapabilities {
  general: boolean;
  grants: boolean;
  public_link: boolean;
  requests: boolean;
}

export interface AccessOwner {
  orguser_id: number;
  email: string;
  name: string | null;
}

export interface GeneralAccess {
  audience: AccessAudience;
  level: AccessLevel;
}

export interface AccessGrant {
  id: number;
  principal_type: PrincipalType;
  principal_id: number | null;
  // Null for group grants — the backend has no single email to report for a
  // group principal. Always a string for principal_type === 'user'.
  email: string | null;
  name: string | null;
  permission: AccessLevel;
  status: GrantStatus;
  // Only populated for principal_type === 'group' rows.
  member_count?: number | null;
}

export interface AccessViewer {
  effective_permission: AccessLevel | null;
  is_owner: boolean;
}

export interface ResourceAccessOverview {
  resource_type: ShareableResourceType;
  resource_id: string;
  capabilities: AccessCapabilities;
  owner: AccessOwner | null;
  general_access: GeneralAccess | null;
  grants: AccessGrant[];
  viewer: AccessViewer;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export function accessKey(
  rtype: ShareableResourceType | null,
  resourceId: number | null
): string | null {
  return rtype && resourceId ? `/api/access/${rtype}/${resourceId}/` : null;
}

export function useResourceAccess(rtype: ShareableResourceType | null, resourceId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ResourceAccessOverview>>(
    accessKey(rtype, resourceId),
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

export interface AddGrantPayload {
  principal_type: PrincipalType;
  // Exactly one of principal_id / email is set. `email` is the invite path
  // (share-with-a-non-member-email, Task 9's backend contract): a known
  // in-org email resolves to an instant active grant; an unknown one sends
  // a Member invitation and creates a pending grant. `principal_type`
  // must be 'user' when `email` is set — the backend 400s email on groups.
  principal_id?: number;
  email?: string;
  permission: AccessLevel;
}

export async function addGrant(
  rtype: ShareableResourceType,
  resourceId: number,
  payload: AddGrantPayload
): Promise<AccessGrant> {
  const response: ApiResponse<AccessGrant> = await apiPost(
    `/api/access/${rtype}/${resourceId}/grants/`,
    payload
  );
  return response.data;
}

export async function removeGrant(
  rtype: ShareableResourceType,
  resourceId: number,
  grantId: number
): Promise<void> {
  await apiDelete(`/api/access/${rtype}/${resourceId}/grants/${grantId}/`);
}

export interface SetGeneralAccessPayload {
  audience: AccessAudience;
  level: AccessLevel;
  // Present (possibly []) only when re-committing after a requires_confirmation response.
  remove_grant_ids?: number[];
}

export interface SetGeneralAccessResult {
  requires_confirmation: boolean;
  persisting_grants: AccessGrant[];
  general_access: GeneralAccess | null;
}

export async function setGeneralAccess(
  rtype: ShareableResourceType,
  resourceId: number,
  payload: SetGeneralAccessPayload
): Promise<SetGeneralAccessResult> {
  const response: ApiResponse<SetGeneralAccessResult> = await apiPut(
    `/api/access/${rtype}/${resourceId}/general/`,
    payload
  );
  return response.data;
}
