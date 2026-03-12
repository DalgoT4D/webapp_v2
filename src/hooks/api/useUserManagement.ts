import useSWR from 'swr';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { OrgUser } from '@/stores/authStore';
import {
  Role,
  Invitation,
  InviteUserForm,
  UpdateUserRoleForm,
  CreateOrgForm,
} from '@/types/user-management';
import { toast } from 'sonner';

// Hook to fetch users
export function useUsers() {
  const { data, error, isLoading, mutate } = useSWR<OrgUser[]>('/api/organizations/users', apiGet);

  return {
    users: data,
    isLoading,
    error,
    mutate,
  };
}

// Hook to fetch roles
export function useRoles() {
  const { data, error, isLoading } = useSWR<Role[]>('/api/data/roles', apiGet);

  return {
    roles: data,
    isLoading,
    error,
  };
}

// Hook to fetch invitations
export function useInvitations() {
  const { data, error, isLoading, mutate } = useSWR<Invitation[]>(
    '/api/v1/users/invitations/',
    apiGet
  );

  return {
    invitations: data,
    isLoading,
    error,
    mutate,
  };
}

// Hook for user actions
export function useUserActions() {
  const updateUserRole = async (data: UpdateUserRoleForm) => {
    try {
      await apiPost('/api/organizations/user_role/modify/', data);
      toast.success('User role updated successfully');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user role');
      throw error;
    }
  };

  const deleteUser = async (email: string) => {
    try {
      await apiPost('/api/v1/organizations/users/delete', { email });
      toast.success('User deleted successfully');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
      throw error;
    }
  };

  return {
    updateUserRole,
    deleteUser,
  };
}

// Hook for invitation actions
export function useInvitationActions() {
  const inviteUser = async (data: InviteUserForm) => {
    try {
      await apiPost('/api/v1/organizations/users/invite/', data);
      toast.success('User invited successfully');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to invite user');
      throw error;
    }
  };

  const resendInvitation = async (invitationId: number) => {
    try {
      await apiPost(`/api/users/invitations/resend/${invitationId}`, {});
      toast.success('Invitation resent successfully');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend invitation');
      throw error;
    }
  };

  const deleteInvitation = async (invitationId: number) => {
    try {
      await apiDelete(`/api/users/invitations/delete/${invitationId}`);
      toast.success('Invitation deleted successfully');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete invitation');
      throw error;
    }
  };

  return {
    inviteUser,
    resendInvitation,
    deleteInvitation,
  };
}

// Hook for organization actions
export function useOrganizationActions() {
  const createOrganization = async (data: CreateOrgForm) => {
    try {
      const response = await apiPost('/api/v1/organizations/', data);
      toast.success('Organization created successfully');
      return response;
    } catch (error: any) {
      toast.error(error.message || 'Failed to create organization');
      throw error;
    }
  };

  return {
    createOrganization,
  };
}

// Public invitation acceptance (no auth required)
export function usePublicInvitationAcceptance() {
  const acceptInvitation = async (
    data: { invite_code: string; password?: string; work_domain?: string },
    showToast = true
  ) => {
    try {
      const response = await apiPost('/api/v1/organizations/users/invite/accept/', data);
      if (showToast) {
        toast.success('Invitation accepted successfully! You can log in now.');
      }
      return response;
    } catch (error: any) {
      if (showToast) {
        toast.error(error.message || 'Failed to accept invitation');
      }
      throw error;
    }
  };

  return {
    acceptInvitation,
  };
}
