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
