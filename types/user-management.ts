// User Management Types - extends existing interfaces from authStore

export interface Role {
  uuid: string;
  name: string;
  slug: string;
}

export interface Invitation {
  id: number;
  invited_email: string;
  invited_role: {
    uuid: string;
    name: string;
  };
  invited_on: string;
}

export interface PersonRow {
  email: string;
  role_slug: string;
  role_name: string;
  status: 'active' | 'pending';
  created_by_email: string | null;
  orguser_id: number | null;
  invitation_id: number | null;
  created_at: string | null;
}

// Form types
export interface InviteUserForm {
  invited_email: string;
  invited_role_uuid: string;
}

export interface UpdateUserRoleForm {
  toupdate_email: string;
  role_uuid: string;
}

export interface CreateOrgForm {
  name: string;
  website?: string; // NGO's website URL
  base_plan: string;
  subscription_duration: string;
  superset_included: boolean;
  start_date?: string;
  end_date?: string;
}
