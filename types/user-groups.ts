export interface GroupListRow {
  id: number;
  name: string;
  member_count: number;
  created_by_email: string | null;
  created_at: string;
}

export interface GroupMember {
  member_id: number;
  orguser_id: number | null;
  email: string;
  role_name: string | null;
  status: 'active' | 'pending';
}

export interface GroupDetail {
  id: number;
  name: string;
  created_by_email: string | null;
  created_at: string;
  members: GroupMember[];
}

export interface CreateGroupPayload {
  name: string;
  orguser_ids?: number[];
  pending_emails?: string[];
  invite_role_uuid?: string | null;
}

export interface AddMembersPayload {
  orguser_ids?: number[];
  pending_emails?: string[];
  invite_role_uuid?: string | null;
}
