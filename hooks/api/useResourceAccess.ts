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
// Per-role permission level (permission-model rework, D1): 'none' extends
// AccessLevel's view/edit to cover "no access" for a role. Backs the
// per-role Default-permissions table (Settings > Access > Roles) and the
// ShareModal General-access section's Analyst/Member rows — both replaced
// the org-wide AccessAudience+AccessLevel pair with one independently
// settable level per role.
export type RolePermissionLevel = 'none' | 'view' | 'edit';
export type PrincipalType = 'user' | 'group';
export type GrantStatus = 'active' | 'pending';
// Roles a share-flow email invite may assign (Phase C3). Mirrors the
// backend's INVITABLE_ROLE_SLUGS — non-member values are admin-callers-only.
export type InviteRoleSlug = 'member' | 'analyst' | 'admin';

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

// Per-resource general access, keyed by role rather than an audience
// threshold (permission-model rework, D1 — replaces the old
// { audience, level } pair). Admins are always implicitly "all access" and
// have no stored level here.
export interface GeneralAccess {
  analyst_level: RolePermissionLevel;
  member_level: RolePermissionLevel;
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
  // Only consulted by the backend when `email` doesn't match an existing
  // OrgUser (the invite path). Defaults to member server-side; analyst/admin
  // require the CALLER to be an admin (403 otherwise).
  invite_role?: InviteRoleSlug;
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
  analyst_level: RolePermissionLevel;
  member_level: RolePermissionLevel;
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

// Transfer ownership — POST /api/access/{rtype}/{id}/owner/ (task-12 backend
// contract). Allowed for the current owner or an org admin (see
// require_owner_access / can_delete_resource); the backend also keeps the
// OLD owner on an Edit grant automatically — nothing to do client-side but
// revalidate the overview after this resolves.
export async function transferOwnership(
  rtype: ShareableResourceType,
  resourceId: number,
  newOwnerOrguserId: number
): Promise<AccessOwner> {
  const response: ApiResponse<AccessOwner> = await apiPost(
    `/api/access/${rtype}/${resourceId}/owner/`,
    { new_owner_orguser_id: newOwnerOrguserId }
  );
  return response.data;
}

// ---- Bulk sharing — POST /api/access/bulk/ (task-17 backend contract) ----
//
// Applies ONE action across a mixed-rtype selection, apply-where-possible
// (never all-or-nothing) — see task-17-report.md for the verbatim shapes.
// `id` is always the stringified pk, matching the soft-link resource_id
// convention used everywhere else in this file's overview/grant types.

export interface BulkItemRef {
  rtype: ShareableResourceType;
  id: string;
}

export type BulkAction = 'add_grant' | 'set_general' | 'toggle_public';

export interface BulkAddGrantPayload {
  principal_type: PrincipalType;
  principal_id?: number;
  email?: string;
  permission: AccessLevel;
}

// Mirrors SetGeneralAccessPayload above (D1 per-role rework) — the bulk
// set_general action shares GeneralAccessUpdate's shape with the single-item
// PUT, just applied across the selection instead of one resource.
export interface BulkSetGeneralPayload {
  analyst_level: RolePermissionLevel;
  member_level: RolePermissionLevel;
  // Present (possibly []) only when re-committing after a requires_confirmation
  // response — a flat, global list of grant ids (unique PKs, no per-resource nesting needed).
  remove_grant_ids?: number[];
}

export interface BulkTogglePublicPayload {
  is_public: boolean;
}

export interface BulkAccessRequest {
  items: BulkItemRef[];
  action: BulkAction;
  // Exactly one of these, matching `action`.
  add_grant?: BulkAddGrantPayload;
  set_general?: BulkSetGeneralPayload;
  toggle_public?: BulkTogglePublicPayload;
}

// Stable machine reason codes from ddpui/core/sharing/sharing_actions.py —
// see SKIP_REASON_COPY in components/sharing/bulk-share-dialog.tsx for the
// plain-language mapping shown to NGO users.
export interface BulkSkippedItem extends BulkItemRef {
  reason: string;
}

export interface BulkConfirmationItem extends BulkItemRef {
  persisting_grants: AccessGrant[];
}

export interface BulkAccessResponse {
  applied: BulkItemRef[];
  skipped: BulkSkippedItem[];
  requires_confirmation: BulkConfirmationItem[];
  applied_count: number;
  skipped_count: number;
}

export async function bulkApplyAccess(request: BulkAccessRequest): Promise<BulkAccessResponse> {
  const response: ApiResponse<BulkAccessResponse> = await apiPost('/api/access/bulk/', request);
  return response.data;
}
