'use client';

import { useMemo, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import {
  useUsers,
  useInvitations,
  useRoles,
  useUserActions,
  useInvitationActions,
} from '@/hooks/api/useUserManagement';
import { useAuthStore } from '@/stores/authStore';
import {
  MoreVertical,
  User,
  Mail,
  Save,
  X,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Filter,
  Edit,
  Trash,
  Send,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreatedByCell } from '@/components/settings/AvatarInitial';
import { LearnAccessLink } from '@/components/settings/access/LearnAccessLink';
import { DeleteUserDialog } from './DeleteUserDialog';
import { DeleteInvitationDialog } from './DeleteInvitationDialog';

type SortColumn = 'email' | 'role' | 'createdBy';

// One merged row per person: an active org user or a pending invitation,
// distinguished by `kind` (drives the leading icon and the actions menu).
interface ActiveRow {
  kind: 'active';
  rowKey: string;
  email: string;
  role: string;
  createdBy: string | null | undefined;
  isSelf: boolean;
}

interface PendingRow {
  kind: 'pending';
  rowKey: string;
  email: string;
  role: string;
  createdBy: string | null | undefined;
  invitationId: number;
}

type MergedRow = ActiveRow | PendingRow;

interface PeopleTableProps {
  /** Empty-state CTA opens the People-tab invite dialog, owned by AccessPage. */
  onInviteClick?: () => void;
}

// Merged People table (Settings → Access → People): one table lists
// everyone; the leading icon carries the state — envelope for a pending
// invitation, person for an active user.
export function PeopleTable({ onInviteClick }: PeopleTableProps = {}) {
  const { users, isLoading: usersLoading, mutate: mutateUsers } = useUsers();
  // Always called (rules of hooks) — the result is only merged in when the
  // viewer has can_view_invitations, so others never see pending rows.
  const {
    invitations: rawInvitations,
    isLoading: invitationsLoading,
    mutate: mutateInvitations,
  } = useInvitations();
  const { roles } = useRoles();
  const { updateUserRole } = useUserActions();
  const { resendInvitation } = useInvitationActions();
  const { hasPermission } = useRbac();
  const { getCurrentOrgUser } = useAuthStore();

  const canViewInvitations = hasPermission(PERMISSIONS.CAN_VIEW_INVITATIONS);
  const canEditUser = hasPermission(PERMISSIONS.CAN_EDIT_ORGUSER);
  const canDeleteUser = hasPermission(PERMISSIONS.CAN_DELETE_ORGUSER);
  const canResendInvitation = hasPermission(PERMISSIONS.CAN_RESEND_EMAIL_VERIFICATION);
  const canDeleteInvitation = hasPermission(PERMISSIONS.CAN_DELETE_INVITATION);

  const invitations = canViewInvitations ? rawInvitations : undefined;
  const currentUser = getCurrentOrgUser();

  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [deleteUserEmail, setDeleteUserEmail] = useState<string | null>(null);
  const [deleteInvitationId, setDeleteInvitationId] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);

  // Sorting and filtering apply over the merged row set.
  const [sortBy, setSortBy] = useState<SortColumn>('email');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [emailFilter, setEmailFilter] = useState('');
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [openFilters, setOpenFilters] = useState({ email: false, role: false });

  const formatRoleName = (roleSlug: string) => {
    // Prefer the org's actual role name from the roles catalog so active
    // and pending rows show identical Role text — otherwise the Role filter
    // splits one role into two differently-cased entries.
    const catalogName = roles?.find((r) => r.slug === roleSlug)?.name;
    if (catalogName) return catalogName;
    return roleSlug.replace('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // The invitations endpoint is org-wide and carries the real inviter per
  // row, so pending rows show who actually sent the invite.
  const mergedRows: MergedRow[] = useMemo(() => {
    const activeRows: ActiveRow[] = (users ?? []).map((user) => ({
      kind: 'active',
      rowKey: `active-${user.email}`,
      email: user.email,
      role: formatRoleName(user.new_role_slug),
      createdBy: user.invited_by,
      isSelf: user.email === currentUser?.email,
    }));

    const pendingRows: PendingRow[] = (invitations ?? []).map((invitation) => ({
      kind: 'pending',
      rowKey: `pending-${invitation.id}`,
      email: invitation.invited_email,
      role: invitation.invited_role.name,
      createdBy: invitation.invited_by,
      invitationId: invitation.id,
    }));

    return [...activeRows, ...pendingRows];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, invitations, currentUser?.email, roles]);

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (column: SortColumn) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-gray-600" />
    ) : (
      <ChevronDown className="w-4 h-4 text-gray-600" />
    );
  };

  const hasActiveFilter = (column: 'email' | 'role') => {
    if (column === 'email') return emailFilter.length > 0;
    return roleFilters.length > 0;
  };

  const renderFilterIcon = (column: 'email' | 'role') => {
    const isActive = hasActiveFilter(column);
    return (
      <div className="relative">
        <Filter
          className={cn(
            'w-4 h-4 transition-colors',
            isActive ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
          )}
        />
        {isActive && <div className="absolute -top-1 -right-1 w-2 h-2 bg-teal-600 rounded-full" />}
      </div>
    );
  };

  const uniqueRoles = useMemo(() => {
    const roleSet = new Set(mergedRows.map((row) => row.role));
    return Array.from(roleSet).sort();
  }, [mergedRows]);

  const handleRoleFilterChange = (role: string, checked: boolean) => {
    if (checked) {
      setRoleFilters((prev) => [...prev, role]);
    } else {
      setRoleFilters((prev) => prev.filter((r) => r !== role));
    }
  };

  const clearAllFilters = () => {
    setEmailFilter('');
    setRoleFilters([]);
  };

  const filteredAndSortedRows = useMemo(() => {
    const filtered = mergedRows.filter((row) => {
      if (emailFilter && !row.email.toLowerCase().includes(emailFilter.toLowerCase())) {
        return false;
      }
      if (roleFilters.length > 0 && !roleFilters.includes(row.role)) {
        return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      let aValue: string;
      let bValue: string;

      if (sortBy === 'email') {
        aValue = a.email.toLowerCase();
        bValue = b.email.toLowerCase();
      } else if (sortBy === 'role') {
        aValue = a.role.toLowerCase();
        bValue = b.role.toLowerCase();
      } else {
        aValue = (a.createdBy ?? '').toLowerCase();
        bValue = (b.createdBy ?? '').toLowerCase();
      }

      if (aValue === bValue) return 0;
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });

    return sorted;
  }, [mergedRows, emailFilter, roleFilters, sortBy, sortOrder]);

  const renderEmailFilter = () => (
    <PopoverContent className="w-80" align="start">
      <div className="space-y-4">
        <div>
          <Label htmlFor="email-filter" className="text-sm font-medium">
            Filter by Email
          </Label>
          <Input
            id="email-filter"
            placeholder="Enter email to filter..."
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            className="mt-2"
          />
        </div>
        {emailFilter && (
          <Button variant="outline" size="sm" onClick={() => setEmailFilter('')} className="w-full">
            Clear Email Filter
          </Button>
        )}
      </div>
    </PopoverContent>
  );

  const renderRoleFilter = () => (
    <PopoverContent className="w-80" align="start">
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Filter by Role</Label>
          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
            {uniqueRoles.map((role) => (
              <div key={role} className="flex items-center space-x-2">
                <Checkbox
                  id={`role-${role}`}
                  checked={roleFilters.includes(role)}
                  onCheckedChange={(checked) => handleRoleFilterChange(role, checked as boolean)}
                />
                <Label htmlFor={`role-${role}`} className="text-sm cursor-pointer">
                  {role}
                </Label>
              </div>
            ))}
          </div>
        </div>
        {roleFilters.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setRoleFilters([])} className="w-full">
            Clear Role Filters
          </Button>
        )}
      </div>
    </PopoverContent>
  );

  const handleEditRole = (userEmail: string, currentRoleSlug: string) => {
    const role = roles?.find((r) => r.slug === currentRoleSlug);
    if (role) {
      setSelectedRole(role.uuid);
      setEditingUser(userEmail);
    }
  };

  const handleSaveRole = async () => {
    if (!editingUser || !selectedRole) return;

    setIsUpdatingRole(true);
    try {
      await updateUserRole({ toupdate_email: editingUser, role_uuid: selectedRole });
      trackEvent(ANALYTICS_EVENTS.USER_ROLE_CHANGED);
      mutateUsers();
      setEditingUser(null);
      setSelectedRole('');
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setSelectedRole('');
  };

  const handleResendInvitation = async (invitationId: number) => {
    setResendingId(invitationId);
    try {
      await resendInvitation(invitationId);
      trackEvent(ANALYTICS_EVENTS.INVITATION_RESENT);
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setResendingId(null);
    }
  };

  const isLoading = usersLoading || (canViewInvitations && invitationsLoading);

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white overflow-hidden p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // The signed-in user's own row always exists, so a literal zero-people org
  // is unreachable. "No people yet" fires when there are no OTHER active
  // users (self only) and no pending invitations.
  const hasOtherActiveUsers = (users?.length ?? 0) > 1;
  const hasPendingInvites = (invitations?.length ?? 0) > 0;

  if (!hasOtherActiveUsers && !hasPendingInvites) {
    return (
      <div
        data-testid="users-empty-state"
        className="border rounded-lg bg-white flex flex-col items-center justify-center gap-4 py-16 px-6 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
          <User className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">No people yet</h3>
        <p className="text-muted-foreground max-w-sm">
          Invite your team members to collaborate. They&apos;ll appear here once they&apos;ve
          accepted your invitation.
        </p>
        <Button variant="primary" onClick={onInviteClick} data-testid="users-empty-invite-btn">
          INVITE USER
        </Button>
        <LearnAccessLink />
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-white">
            <TableRow className="bg-gray-50">
              <TableHead className="w-[30%] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-medium text-base hover:bg-transparent justify-start"
                    onClick={() => handleSort('email')}
                    data-testid="sort-email-button"
                  >
                    <div className="flex items-center gap-2">
                      Email
                      {renderSortIcon('email')}
                    </div>
                  </Button>
                  <Popover
                    open={openFilters.email}
                    onOpenChange={(open) => setOpenFilters((prev) => ({ ...prev, email: open }))}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0 hover:bg-gray-100"
                        aria-label="Filter by email"
                        data-testid="filter-email-button"
                      >
                        {renderFilterIcon('email')}
                      </Button>
                    </PopoverTrigger>
                    {renderEmailFilter()}
                  </Popover>
                </div>
              </TableHead>
              <TableHead className="w-[25%] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-medium text-base hover:bg-transparent justify-start"
                    onClick={() => handleSort('role')}
                    data-testid="sort-role-button"
                  >
                    <div className="flex items-center gap-2">
                      Role
                      {renderSortIcon('role')}
                    </div>
                  </Button>
                  <Popover
                    open={openFilters.role}
                    onOpenChange={(open) => setOpenFilters((prev) => ({ ...prev, role: open }))}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0 hover:bg-gray-100"
                        aria-label="Filter by role"
                        data-testid="filter-role-button"
                      >
                        {renderFilterIcon('role')}
                      </Button>
                    </PopoverTrigger>
                    {renderRoleFilter()}
                  </Popover>
                </div>
              </TableHead>
              <TableHead className="w-[25%] px-4 py-3">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-medium text-base hover:bg-transparent justify-start"
                  onClick={() => handleSort('createdBy')}
                  data-testid="sort-createdBy-button"
                >
                  <div className="flex items-center gap-2">
                    Created By
                    {renderSortIcon('createdBy')}
                  </div>
                </Button>
              </TableHead>
              <TableHead className="w-[10%] font-medium text-base px-4 py-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedRows.map((row) => (
              <TableRow key={row.rowKey}>
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      data-testid={`row-icon-${row.email}`}
                      data-icon={row.kind === 'pending' ? 'mail' : 'user'}
                      className="inline-flex"
                    >
                      {row.kind === 'pending' ? (
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                    <span className="font-medium text-gray-900">{row.email}</span>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  {row.kind === 'active' && editingUser === row.email ? (
                    <div className="flex items-center gap-2">
                      <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles?.map((role) => (
                            <SelectItem key={role.uuid} value={role.uuid}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleSaveRole} disabled={isUpdatingRole}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isUpdatingRole}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-gray-700">{row.role}</div>
                  )}
                </TableCell>
                <TableCell
                  className="px-4 py-3"
                  data-testid={
                    row.kind === 'active'
                      ? `user-created-by-${row.email}`
                      : `invitation-created-by-${row.invitationId}`
                  }
                >
                  <CreatedByCell email={row.createdBy} />
                </TableCell>
                <TableCell className="px-4 py-3 text-start">
                  {row.kind === 'active' ? (
                    !row.isSelf && (canEditUser || canDeleteUser) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 p-0 hover:bg-gray-100"
                            data-testid={`user-actions-${row.email}`}
                          >
                            <MoreVertical className="h-4 w-4 text-gray-600" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEditUser && (
                            <DropdownMenuItem
                              onClick={() => {
                                const user = users?.find((u) => u.email === row.email);
                                if (user) handleEditRole(user.email, user.new_role_slug);
                              }}
                              className="cursor-pointer"
                              data-testid={`edit-role-menu-item-${row.email}`}
                            >
                              <Edit className="w-4 h-4 text-gray-600" /> Edit Role
                            </DropdownMenuItem>
                          )}
                          {canDeleteUser && (
                            <DropdownMenuItem
                              onClick={() => setDeleteUserEmail(row.email)}
                              className="cursor-pointer text-destructive focus:text-destructive"
                              data-testid={`delete-user-menu-item-${row.email}`}
                            >
                              <Trash className="w-4 h-4" />
                              Delete User
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="inline-block cursor-not-allowed">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled
                          className="h-8 w-8 p-0 opacity-40 pointer-events-none"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </span>
                    )
                  ) : (
                    (canResendInvitation || canDeleteInvitation) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 p-0 hover:bg-gray-100"
                            data-testid={`invitation-actions-${row.invitationId}`}
                          >
                            <MoreVertical className="h-4 w-4 text-gray-600" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canResendInvitation && (
                            <DropdownMenuItem
                              onClick={() => handleResendInvitation(row.invitationId)}
                              disabled={resendingId === row.invitationId}
                              data-testid={`resend-invitation-${row.invitationId}`}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              {resendingId === row.invitationId ? 'Resending...' : 'Resend'}
                            </DropdownMenuItem>
                          )}
                          {canDeleteInvitation && (
                            <DropdownMenuItem
                              onClick={() => setDeleteInvitationId(row.invitationId)}
                              className="text-destructive"
                              data-testid={`delete-invitation-${row.invitationId}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredAndSortedRows.length === 0 && mergedRows.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No people match the current filters.{' '}
            <Button variant="link" onClick={clearAllFilters} className="p-0 h-auto">
              Clear all filters
            </Button>
          </div>
        )}
      </div>

      <DeleteUserDialog
        open={!!deleteUserEmail}
        onOpenChange={(open) => !open && setDeleteUserEmail(null)}
        userEmail={deleteUserEmail || ''}
        onSuccess={() => {
          mutateUsers();
          setDeleteUserEmail(null);
        }}
      />
      <DeleteInvitationDialog
        open={!!deleteInvitationId}
        onOpenChange={(open) => !open && setDeleteInvitationId(null)}
        invitationId={deleteInvitationId || 0}
        onSuccess={() => {
          mutateInvitations();
          setDeleteInvitationId(null);
        }}
      />
    </>
  );
}
