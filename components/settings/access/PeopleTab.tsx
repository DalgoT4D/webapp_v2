'use client';

import { useMemo, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { usePeople } from '@/hooks/api/useAccess';
import { useInvitationActions, useRoles, useUserActions } from '@/hooks/api/useUserManagement';
import { useAuthStore } from '@/stores/authStore';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  MoreVertical,
  User,
  Mail,
  Send,
  Trash2,
  Edit,
  Save,
  X,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeleteUserDialog } from '@/components/settings/user-management/DeleteUserDialog';
import { DeleteInvitationDialog } from '@/components/settings/user-management/DeleteInvitationDialog';

type SortColumn = 'email' | 'role';
type SortOrder = 'asc' | 'desc';

export function PeopleTab() {
  const { people, isLoading, mutate } = usePeople();
  const { roles } = useRoles();
  const { updateUserRole } = useUserActions();
  const { resendInvitation } = useInvitationActions();
  const { hasPermission } = useRbac();
  const { getCurrentOrgUser } = useAuthStore();

  const [deleteUserEmail, setDeleteUserEmail] = useState<string | null>(null);
  const [deleteInvitationId, setDeleteInvitationId] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [selectedRoleUuid, setSelectedRoleUuid] = useState<string>('');
  const [isSavingRole, setIsSavingRole] = useState(false);

  const [sortBy, setSortBy] = useState<SortColumn>('email');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [emailFilter, setEmailFilter] = useState('');
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [openFilters, setOpenFilters] = useState({ email: false, role: false });

  const currentUser = getCurrentOrgUser();
  const canEditUser = hasPermission(PERMISSIONS.CAN_EDIT_ORGUSER);
  const canDeleteUser = hasPermission(PERMISSIONS.CAN_DELETE_ORGUSER);
  const canDeleteInvitation = hasPermission(PERMISSIONS.CAN_DELETE_INVITATION);
  const canResendInvitation = hasPermission(PERMISSIONS.CAN_RESEND_EMAIL_VERIFICATION);

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
    if (column === 'role') return roleFilters.length > 0;
    return false;
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

  const uniqueRoleNames = useMemo(() => {
    if (!people) return [];
    return Array.from(new Set(people.map((p) => p.role_name))).sort();
  }, [people]);

  const handleRoleFilterChange = (roleName: string, checked: boolean) => {
    if (checked) {
      setRoleFilters((prev) => [...prev, roleName]);
    } else {
      setRoleFilters((prev) => prev.filter((r) => r !== roleName));
    }
  };

  const clearAllFilters = () => {
    setEmailFilter('');
    setRoleFilters([]);
  };

  const filteredAndSorted = useMemo(() => {
    if (!people) return [];
    const filtered = people.filter((p) => {
      if (emailFilter && !p.email.toLowerCase().includes(emailFilter.toLowerCase())) return false;
      if (roleFilters.length > 0 && !roleFilters.includes(p.role_name)) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      const aVal = (sortBy === 'email' ? a.email : a.role_name).toLowerCase();
      const bVal = (sortBy === 'email' ? b.email : b.role_name).toLowerCase();
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return sorted;
  }, [people, emailFilter, roleFilters, sortBy, sortOrder]);

  const handleResend = async (invitationId: number) => {
    setResendingId(invitationId);
    try {
      await resendInvitation(invitationId);
      trackEvent(ANALYTICS_EVENTS.INVITATION_RESENT);
    } catch {
      // handled in hook
    } finally {
      setResendingId(null);
    }
  };

  const handleEditRole = (email: string, currentRoleSlug: string) => {
    const role = roles?.find((r) => r.slug === currentRoleSlug);
    if (!role) return;
    setSelectedRoleUuid(role.uuid);
    setEditingEmail(email);
  };

  const handleCancelEditRole = () => {
    setEditingEmail(null);
    setSelectedRoleUuid('');
  };

  const handleSaveRole = async () => {
    if (!editingEmail || !selectedRoleUuid) return;
    setIsSavingRole(true);
    try {
      await updateUserRole({ toupdate_email: editingEmail, role_uuid: selectedRoleUuid });
      trackEvent(ANALYTICS_EVENTS.USER_ROLE_CHANGED);
      mutate();
      handleCancelEditRole();
    } catch {
      // handled in hook
    } finally {
      setIsSavingRole(false);
    }
  };

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
            {uniqueRoleNames.map((roleName) => {
              const id = `role-${roleName.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
              return (
                <div key={roleName} className="flex items-center space-x-2">
                  <Checkbox
                    id={id}
                    checked={roleFilters.includes(roleName)}
                    onCheckedChange={(checked) =>
                      handleRoleFilterChange(roleName, checked as boolean)
                    }
                  />
                  <Label htmlFor={id} className="text-sm cursor-pointer">
                    {roleName}
                  </Label>
                </div>
              );
            })}
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

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white overflow-hidden p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[40%]">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="h-auto p-0 hover:bg-transparent justify-start"
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
              <TableHead className="w-[25%]">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="h-auto p-0 hover:bg-transparent justify-start"
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
              <TableHead className="w-[25%]">Created By</TableHead>
              <TableHead className="w-[10%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.map((person) => {
              const key =
                person.status === 'active' ? `u-${person.orguser_id}` : `i-${person.invitation_id}`;
              const isCurrent = person.status === 'active' && person.email === currentUser?.email;
              const canShowActions =
                person.status === 'active'
                  ? !isCurrent && (canEditUser || canDeleteUser)
                  : canResendInvitation || canDeleteInvitation;
              const isEditingThisRow = person.status === 'active' && editingEmail === person.email;

              return (
                <TableRow
                  key={key}
                  className="hover:bg-gray-50"
                  data-testid={`person-row-${person.email}`}
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      {person.status === 'active' ? (
                        <User className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium text-gray-900">{person.email}</span>
                      {person.status === 'pending' && (
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    {isEditingThisRow ? (
                      <div className="flex items-center gap-2">
                        <Select value={selectedRoleUuid} onValueChange={setSelectedRoleUuid}>
                          <SelectTrigger
                            className="w-48"
                            data-testid={`role-select-${person.email}`}
                          >
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
                        <Button
                          size="sm"
                          onClick={handleSaveRole}
                          disabled={isSavingRole}
                          data-testid={`role-save-${person.email}`}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEditRole}
                          disabled={isSavingRole}
                          data-testid={`role-cancel-${person.email}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-gray-700">{person.role_name}</div>
                    )}
                  </TableCell>
                  <TableCell className="py-4 text-gray-600">
                    {person.created_by_email ?? '—'}
                  </TableCell>
                  <TableCell className="py-4">
                    {canShowActions ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 p-0 hover:bg-gray-100"
                            data-testid={`person-actions-${person.email}`}
                          >
                            <MoreVertical className="h-4 w-4 text-gray-600" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {person.status === 'pending' && canResendInvitation && (
                            <DropdownMenuItem
                              onClick={() => handleResend(person.invitation_id!)}
                              disabled={resendingId === person.invitation_id}
                              data-testid={`resend-invitation-${person.invitation_id}`}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              {resendingId === person.invitation_id ? 'Resending...' : 'Resend'}
                            </DropdownMenuItem>
                          )}
                          {person.status === 'pending' && canDeleteInvitation && (
                            <DropdownMenuItem
                              onClick={() => setDeleteInvitationId(person.invitation_id!)}
                              className="text-destructive focus:text-destructive"
                              data-testid={`delete-invitation-${person.invitation_id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                          {person.status === 'active' && canEditUser && (
                            <DropdownMenuItem
                              onClick={() => handleEditRole(person.email, person.role_slug)}
                              data-testid={`edit-role-${person.email}`}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Role
                            </DropdownMenuItem>
                          )}
                          {person.status === 'active' && canDeleteUser && (
                            <DropdownMenuItem
                              onClick={() => setDeleteUserEmail(person.email)}
                              className="text-destructive focus:text-destructive"
                              data-testid={`delete-user-${person.email}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        className="h-8 w-8 p-0 opacity-40 pointer-events-none"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filteredAndSorted.length === 0 && people && people.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No people match the current filters.{' '}
            <Button variant="link" onClick={clearAllFilters} className="p-0 h-auto">
              Clear all filters
            </Button>
          </div>
        )}
        {people && people.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No people yet.</div>
        )}
      </div>

      <DeleteUserDialog
        open={!!deleteUserEmail}
        onOpenChange={(open) => !open && setDeleteUserEmail(null)}
        userEmail={deleteUserEmail || ''}
        onSuccess={() => {
          mutate();
          setDeleteUserEmail(null);
        }}
      />
      <DeleteInvitationDialog
        open={!!deleteInvitationId}
        onOpenChange={(open) => !open && setDeleteInvitationId(null)}
        invitationId={deleteInvitationId || 0}
        onSuccess={() => {
          mutate();
          setDeleteInvitationId(null);
        }}
      />
    </>
  );
}
