import type { UserGroup, UserGroupDetail } from '@/hooks/api/useUserGroups';

export function createMockGroup(overrides: Partial<UserGroup> = {}): UserGroup {
  return {
    id: 1,
    name: 'Funders',
    member_count: 2,
    shared_resource_count: 3,
    created_by: { orguser_id: 5, email: 'asha@ngo.org', name: 'Asha Kumar' },
    created_at: '2026-01-01T00:00:00Z',
    member_preview: ['asha@ngo.org', 'meera@ngo.org'],
    ...overrides,
  };
}

export function createMockGroupDetail(overrides: Partial<UserGroupDetail> = {}): UserGroupDetail {
  return {
    ...createMockGroup(),
    members: [
      {
        id: 10,
        orguser_id: 5,
        email: 'asha@ngo.org',
        name: 'Asha Kumar',
        pending_email: null,
        status: 'active',
        role: 'analyst',
      },
      {
        id: 11,
        orguser_id: 6,
        email: 'meera@ngo.org',
        name: 'Meera Das',
        pending_email: null,
        status: 'active',
        role: 'member',
      },
    ],
    ...overrides,
  };
}
