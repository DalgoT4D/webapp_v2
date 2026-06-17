---
description: Settings domain map — billing, user management (invites/roles), about, and the permission-gating model.
paths:
  - "components/settings/**"
  - "app/settings/**"
  - "hooks/api/useUserManagement.ts"
  - "hooks/api/usePermissions.ts"
  - "types/user-management.ts"
---

# Settings — Domain Map

Org-scoped settings: Billing, User Management (invites + roles), About. All actions are permission-gated; the frontend disables UI but the backend enforces access.

## Where things live

| Concern | Location |
|---|---|
| Billing | `app/settings/billing/page.tsx` → `components/settings/billing.tsx` |
| User Management | `app/settings/user-management/page.tsx` → `components/settings/user-management/UserManagement.tsx` |
| About | `app/settings/about/page.tsx` → `components/settings/about.tsx` |
| Invite/role components | `components/settings/user-management/{InviteUserDialog,UsersTable,InvitationsTable,DeleteUserDialog,DeleteInvitationDialog}.tsx` |
| Org creation | `components/settings/organizations/CreateOrgDialog.tsx` |
| Hooks | `hooks/api/useUserManagement.ts` (`useUsers`, `useRoles`, `useInvitations`, `useUserActions`, `useInvitationActions`), `usePermissions.ts` (`useUserPermissions`) |
| Types | `types/user-management.ts` (`Role`, `Invitation`, `InviteUserForm`, `UpdateUserRoleForm`) |
| Backend | `DDP_backend/ddpui/api/user_org_api.py`, `api/org_preferences_api.py` |

## Data flow

```
Invite + role:
  POST /api/v1/organizations/users/invite/      (InviteUserForm)
  GET  /api/v1/users/invitations/               (pending)
  POST /api/v1/organizations/users/invite/accept/ (invite_code + password)
  POST /api/organizations/user_role/modify/     (email + role_uuid)
  → guarded by @has_permission([can_create_invitation, can_view_invitations, can_edit_orguser_role])
Billing: GET /api/orgpreferences/org-plan → POST /api/orgpreferences/org-plan/upgrade
About:   GET /api/orgpreferences/toolinfo (Airbyte/Prefect/dbt/Elementary/Superset versions)
```

## ⚠️ Gotchas

- **Permission gating is centralized** — use `useUserPermissions()` (`hasPermission`/`hasAnyPermission`/`hasAllPermissions`); it reads `currentOrgUser.permissions`. UI gating is convenience only — the backend `@has_permission` decorator is the real enforcement. **Never mock `useAuthStore` for permission checks in tests; mock `useUserPermissions`** (see `rules/testing.md`).
- **Role-level hierarchy** — you cannot assign a role with a higher level than your own (backend returns 403).
- **Everything is org-scoped** — endpoints filter by `orguser.org`; no cross-org visibility.
- **Billing is org-level** — `org-plan/upgrade` emails biz-dev (idempotent per request); Superset access is a plan feature, not per-user.
