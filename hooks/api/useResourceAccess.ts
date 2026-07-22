/**
 * useResourceAccess — the single place that talks to /api/access/*.
 * Types mirror ddpui/api/access_api.py + ddpui/schemas/access_schema.py.
 */
import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

// Mirrors ddpui/core/sharing/shareable_types.py — the rtypes with a registry entry.
export type ShareableResourceType = 'dashboard' | 'report' | 'alert' | 'metric' | 'kpi' | 'chart';

export type AccessAudience = 'private' | 'admins' | 'analysts_plus' | 'all_users';
export type AccessLevel = 'view' | 'edit';
// Per-role permission level: 'none' extends AccessLevel's view/edit to
// cover "no access" for a role.
export type RolePermissionLevel = 'none' | 'view' | 'edit';
export type PrincipalType = 'user' | 'group';
export type GrantStatus = 'active' | 'pending';
// Roles a share-flow email invite may assign. Mirrors the backend's
// INVITABLE_ROLE_SLUGS — non-member values are admin-callers-only.
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

// Per-resource general access, keyed by role. Admins are always implicitly
// "all access" and have no stored level here.
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

// ---- Chart coverage ----
// Mirrors the backend's PrincipalGapOut/ChartCoverageOut. Shared by the
// embed-time warning and every dashboard broadening path.

export interface PrincipalGap {
  principal_type: 'user' | 'group' | 'invite';
  principal_id: number | null;
  name: string | null;
  email: string | null;
  // Member-role principal: extend never copies these onto the chart —
  // only acknowledgeable via `proceed`.
  skipped_member: boolean;
}

export interface ChartCoverageVerdict {
  chart_id: number;
  title: string;
  covered: boolean;
  // 'analyst' (extendable) and/or 'member' (informational — charts can't
  // admit Members yet).
  role_gaps: string[];
  principal_gaps: PrincipalGap[];
  // The dashboard's public link exposes this chart anonymously —
  // informational, never extendable.
  public_exposure: boolean;
  // True when "extend" can close at least one gap on this chart.
  extendable: boolean;
  // True when the calling viewer resolves to Edit on this chart — extend
  // requires it.
  viewer_can_edit: boolean;
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
  // Exactly one of principal_id / email is set. A known in-org email becomes
  // an instant active grant; an unknown one sends an invitation and creates
  // a pending grant. `email` requires principal_type 'user' (backend 400s groups).
  principal_id?: number;
  email?: string;
  permission: AccessLevel;
  // Only used on the invite path. Defaults to member server-side;
  // analyst/admin require the caller to be an admin (403 otherwise).
  invite_role?: InviteRoleSlug;
  // Broadening confirm fields: re-send with one or both present to commit a
  // grant flagged requires_confirmation. Ignored for every rtype but dashboard.
  extend_chart_ids?: number[];
  proceed?: boolean;
}

// Either the created/updated grant, or a broadening confirmation (nothing
// written). Callers MUST check `requires_confirmation` before treating
// `grant` as committed.
export interface GrantCreateResult {
  requires_confirmation: boolean;
  under_covering_charts: ChartCoverageVerdict[];
  grant: AccessGrant | null;
}

export async function addGrant(
  rtype: ShareableResourceType,
  resourceId: number,
  payload: AddGrantPayload
): Promise<GrantCreateResult> {
  const response: ApiResponse<GrantCreateResult> = await apiPost(
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
  // Broadening mirror, dashboards only: re-send to commit a raise flagged
  // requires_confirmation. Narrowing one role while widening the other may
  // need both confirm fields at once.
  extend_chart_ids?: number[];
  proceed?: boolean;
}

export interface SetGeneralAccessResult {
  requires_confirmation: boolean;
  persisting_grants: AccessGrant[];
  under_covering_charts: ChartCoverageVerdict[];
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

// Allowed for the current owner or an org admin. The backend keeps the old
// owner on an Edit grant automatically — just revalidate after this resolves.
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

// ---- Bulk sharing — POST /api/access/bulk/ ----
// Applies one action across a mixed-rtype selection, apply-where-possible
// (never all-or-nothing). `id` is always the stringified pk.

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
  // Flat, global lists; the server partitions `extend_chart_ids` per
  // dashboard by tile membership.
  extend_chart_ids?: number[];
  proceed?: boolean;
}

// Mirrors SetGeneralAccessPayload above, applied across the selection
// instead of one resource.
export interface BulkSetGeneralPayload {
  analyst_level: RolePermissionLevel;
  member_level: RolePermissionLevel;
  // Present (possibly []) only when re-committing after requires_confirmation —
  // a flat, global list of grant ids.
  remove_grant_ids?: number[];
  // Broadening mirror: a flat, global list of chart ids, partitioned per
  // dashboard server-side.
  extend_chart_ids?: number[];
  proceed?: boolean;
}

export interface BulkTogglePublicPayload {
  is_public: boolean;
  // Public exposure is never extendable, so no `extend_chart_ids` here —
  // only the acknowledge-and-commit flag.
  proceed?: boolean;
}

export interface BulkAccessRequest {
  items: BulkItemRef[];
  action: BulkAction;
  // Exactly one of these, matching `action`.
  add_grant?: BulkAddGrantPayload;
  set_general?: BulkSetGeneralPayload;
  toggle_public?: BulkTogglePublicPayload;
}

// Stable machine reason codes from the backend; SKIP_REASON_COPY in
// bulk-share-dialog.tsx maps them to plain language.
export interface BulkSkippedItem extends BulkItemRef {
  reason: string;
}

export interface BulkConfirmationItem extends BulkItemRef {
  persisting_grants: AccessGrant[];
  // Populated for dashboard broadening: the exposed charts, named.
  under_covering_charts: ChartCoverageVerdict[];
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
