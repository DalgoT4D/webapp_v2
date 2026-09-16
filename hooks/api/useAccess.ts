import useSWR from 'swr';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/lib/api';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, type AnalyticsEvent } from '@/constants/analytics';
import type { PersonRow } from '@/types/user-management';
import type {
  GroupListRow,
  GroupDetail,
  CreateGroupPayload,
  AddMembersPayload,
} from '@/types/user-groups';
import type { ShareRow, AddGrantsPayload, UpdateGrantPayload, AccessLevel } from '@/types/access';

export function usePeople(enabled: boolean = true) {
  const { data, error, isLoading, mutate } = useSWR<PersonRow[]>(
    enabled ? '/api/v1/organizations/people' : null,
    apiGet
  );

  return {
    people: data,
    isLoading,
    error,
    mutate,
  };
}

export function useActiveMembers(enabled: boolean = true) {
  const { data, error, isLoading, mutate } = useSWR<PersonRow[]>(
    enabled ? '/api/v1/organizations/active-members' : null,
    apiGet
  );

  return {
    people: data,
    isLoading,
    error,
    mutate,
  };
}

export function useUserGroups(enabled: boolean = true) {
  const { data, error, isLoading, mutate } = useSWR<GroupListRow[]>(
    enabled ? '/api/v1/organizations/user_groups' : null,
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

export type GeneralAccessMode = 'internal' | 'private' | 'public';

export interface ParentBlock {
  dashboard_id: number;
  dashboard_title: string;
  mode: GeneralAccessMode;
}

export interface GeneralAccessState {
  mode: GeneralAccessMode;
  supports_public: boolean;
  allow_public_sharing: boolean;
  public_url?: string | null;
  public_access_count: number;
  last_public_accessed?: string | null;
  caller_access_via_floor: boolean;
  parent_blocks: ParentBlock[];
}

export interface OwnerInfo {
  orguser_id: number;
  email: string;
  role_name?: string | null;
}

interface GrantsResponse {
  shares: ShareRow[];
  caller_is_owner: boolean;
  general_access: GeneralAccessState;
  owner?: OwnerInfo | null;
}

export function useResourceGrants(rtype: string | null, resourceId: number | string | null) {
  const key = rtype && resourceId != null ? `/api/access/${rtype}/${resourceId}/grants` : null;
  const { data, error, isLoading, mutate } = useSWR<GrantsResponse>(key, apiGet);
  return {
    shares: data?.shares,
    callerIsOwner: data?.caller_is_owner ?? false,
    generalAccess: data?.general_access,
    owner: data?.owner ?? null,
    isLoading,
    error,
    mutate,
  };
}

interface AddGrantsResponse {
  shares: ShareRow[];
  warnings: string[];
}

export function useResourceGrantActions(rtype: string, resourceId: number | string) {
  const base = `/api/access/${rtype}/${resourceId}/grants`;

  const addGrants = async (payload: AddGrantsPayload): Promise<AddGrantsResponse> => {
    try {
      const res = (await (apiPost as any)(base, payload)) as AddGrantsResponse;
      toast.success('Sharing updated');
      res.warnings?.forEach((w) => toast.warning(w));
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

export async function transferOwnership(
  rtype: string,
  resourceId: number,
  toOrguserId: number,
  stripPreviousOwnerAccess = false
): Promise<void> {
  try {
    await (apiPost as any)(`/api/access/${rtype}/${resourceId}/transfer-ownership`, {
      to_orguser_id: toOrguserId,
      strip_previous_owner_access: stripPreviousOwnerAccess,
    });
    toast.success('Ownership transferred');
  } catch (error: any) {
    toast.error(error?.message || 'Failed to transfer ownership');
    throw error;
  }
}

export interface TransferCandidate {
  orguser_id: number;
  email: string;
  role_name?: string | null;
  access_level: 'no_access' | 'view' | 'edit';
  is_owner: boolean;
}

export function useTransferCandidates(rtype: string | null, resourceId: number | string | null) {
  const key = rtype && resourceId != null ? `/api/access/${rtype}/${resourceId}/candidates` : null;
  const { data, error, isLoading, mutate } = useSWR<TransferCandidate[]>(key, apiGet);
  return {
    candidates: data,
    isLoading,
    error,
    mutate,
  };
}

export interface UpdateGeneralAccessResponse {
  mode: GeneralAccessMode;
  is_private: boolean;
  is_public: boolean;
  public_url?: string;
  public_share_token?: string;
}

/**
 * Going public, per resource type: the event and the id property its payload names.
 *
 * Tracked here rather than at the call sites because this one function is the only way any
 * resource goes public — the previous per-resource `update*Sharing` helpers each needed their
 * own copy of this — and because ShareModal lives in components/ui/, which we keep free of
 * analytics.
 *
 * Only going public fires: turning sharing off is not an outcome we measure, and one event
 * for both directions made the count meaningless. `chart` and `kpi` also flow through here
 * but have no event of their own yet, so they are deliberately absent rather than folded
 * into a generic one that couldn't be split by resource.
 */
const MADE_PUBLIC_EVENT_FOR: Record<string, { event: AnalyticsEvent; idKey: string }> = {
  dashboard: { event: ANALYTICS_EVENTS.DASHBOARD_MADE_PUBLIC, idKey: 'dashboard_id' },
  report: { event: ANALYTICS_EVENTS.REPORT_MADE_PUBLIC, idKey: 'report_id' },
};

export async function updateGeneralAccess(
  rtype: string,
  resourceId: number,
  mode: GeneralAccessMode
): Promise<UpdateGeneralAccessResponse> {
  try {
    const res = (await apiPatch(`/api/access/${rtype}/${resourceId}/general-access`, {
      mode,
    })) as UpdateGeneralAccessResponse;
    const tracked = mode === 'public' ? MADE_PUBLIC_EVENT_FOR[rtype] : undefined;
    if (tracked) trackEvent(tracked.event, { [tracked.idKey]: resourceId });
    return res;
  } catch (error: any) {
    toast.error(error?.message || 'Failed to update access');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Request access

export interface AccessRequestRow {
  id: number;
  requester_id: number;
  requester_email: string;
  requested_level: 'view' | 'edit';
  note: string | null;
  status: string;
  created_at: string;
}

export function useAccessRequests(rtype: string | null, resourceId: number | null) {
  const key =
    rtype && resourceId != null ? `/api/access/${rtype}/${resourceId}/request-access` : null;
  const { data, error, isLoading, mutate } = useSWR<AccessRequestRow[]>(key, apiGet);
  return { requests: data, isLoading, error, mutate };
}

export async function createAccessRequest(
  rtype: string,
  resourceId: number,
  payload: { requested_level: 'view' | 'edit'; note?: string }
): Promise<AccessRequestRow> {
  try {
    const res = await (apiPost as any)(
      `/api/access/${rtype}/${resourceId}/request-access`,
      payload
    );
    toast.success('Access request sent');
    return res;
  } catch (error: any) {
    toast.error(error?.message || 'Failed to send access request');
    throw error;
  }
}

export async function respondToAccessRequest(
  rtype: string,
  resourceId: number,
  reqId: number,
  decision: 'approved' | 'declined',
  grantedLevel?: 'view' | 'edit'
): Promise<void> {
  try {
    await (apiPost as any)(`/api/access/${rtype}/${resourceId}/request-access/${reqId}/respond`, {
      decision,
      ...(grantedLevel ? { granted_level: grantedLevel } : {}),
    });
    toast.success(decision === 'approved' ? 'Request approved' : 'Request declined');
  } catch (error: any) {
    toast.error(error?.message || 'Failed to respond to request');
    throw error;
  }
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
