export type AccessLevel = 'view' | 'edit';
export type PrincipalType = 'user' | 'group';
export type ShareRowKind = 'user' | 'group' | 'invitation';
export type ShareRowStatus = 'active' | 'pending';

export interface CascadeSource {
  dashboard_id: number;
  dashboard_title: string;
}

export interface ShareRow {
  share_id: number | null;
  principal_type: ShareRowKind;
  principal_id: number | null;
  email: string | null;
  label: string;
  role_or_group: string | null;
  access_level: AccessLevel;
  status: ShareRowStatus;
  cascade_sources: CascadeSource[];
}

export interface PrincipalGrantPayload {
  principal_type: PrincipalType;
  principal_id: number;
  access_level: AccessLevel;
}

export interface PendingGrantPayload {
  email: string;
  access_level: AccessLevel;
}

export interface AddGrantsPayload {
  principals?: PrincipalGrantPayload[];
  pending_grants?: PendingGrantPayload[];
  invite_role_uuid?: string | null;
}

export interface UpdateGrantPayload {
  access_level: AccessLevel;
}
