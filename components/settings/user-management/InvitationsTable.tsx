'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useInvitations, useInvitationActions } from '@/hooks/api/useUserManagement';
import {
  MoreHorizontal,
  Mail,
  Send,
  Trash2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DeleteInvitationDialog } from './DeleteInvitationDialog';

export function InvitationsTable() {
  const { invitations, isLoading, mutate } = useInvitations();
  const { resendInvitation } = useInvitationActions();
  const { hasPermission } = useUserPermissions();

  const [deleteInvitation, setDeleteInvitation] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);

  // Filtering and sorting state
  const [sortBy, setSortBy] = useState<'email' | 'role' | 'sent_on'>('sent_on');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Email filter state
  const [emailFilter, setEmailFilter] = useState('');

  // Role filter state
  const [roleFilters, setRoleFilters] = useState<string[]>([]);

  // Date filter state
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Filter dropdown states
  const [openFilters, setOpenFilters] = useState({
    email: false,
    role: false,
    date: false,
  });

  const canDeleteInvitation = hasPermission('can_delete_invitation');
  const canResendInvitation = hasPermission('can_resend_email_verification');

  // Handle sorting
  const handleSort = (column: 'email' | 'role' | 'sent_on') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'sent_on' ? 'desc' : 'asc');
    }
  };

  // Render sort icon
  const renderSortIcon = (column: 'email' | 'role' | 'sent_on') => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-gray-600" />
    ) : (
      <ChevronDown className="w-4 h-4 text-gray-600" />
    );
  };

  // Check if filter is active
  const hasActiveFilter = (column: 'email' | 'role' | 'date') => {
    if (column === 'email') {
      return emailFilter.length > 0;
    }
    if (column === 'role') {
      return roleFilters.length > 0;
    }
    if (column === 'date') {
      return dateFilter !== 'all';
    }
    return false;
  };

  // Render filter icon
  const renderFilterIcon = (column: 'email' | 'role' | 'date') => {
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

  // Get unique roles for filtering
  const uniqueRoles = useMemo(() => {
    if (!invitations) return [];
    const roleSet = new Set(invitations.map((invitation) => invitation.invited_role.name));
    return Array.from(roleSet).sort();
  }, [invitations]);

  // Handle role filter change
  const handleRoleFilterChange = (roleName: string, checked: boolean) => {
    if (checked) {
      setRoleFilters((prev) => [...prev, roleName]);
    } else {
      setRoleFilters((prev) => prev.filter((r) => r !== roleName));
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setEmailFilter('');
    setRoleFilters([]);
    setDateFilter('all');
  };

  // Apply filters and sort invitations
  const filteredAndSortedInvitations = useMemo(() => {
    if (!invitations) return [];

    // Apply filters
    const filtered = invitations.filter((invitation) => {
      // Email filter
      if (emailFilter) {
        if (!invitation.invited_email.toLowerCase().includes(emailFilter.toLowerCase())) {
          return false;
        }
      }

      // Role filter
      if (roleFilters.length > 0) {
        if (!roleFilters.includes(invitation.invited_role.name)) {
          return false;
        }
      }

      // Date filter
      if (dateFilter !== 'all') {
        if (!invitation.invited_on) return false;
        const invitedDate = new Date(invitation.invited_on);
        const now = new Date();
        switch (dateFilter) {
          case 'today': {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (invitedDate < today) return false;
            break;
          }
          case 'week': {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (invitedDate < weekAgo) return false;
            break;
          }
          case 'month': {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (invitedDate < monthAgo) return false;
            break;
          }
        }
      }

      return true;
    });

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'sent_on') {
        const toTs = (v: unknown) => {
          const t = new Date(v as any).getTime();
          return Number.isFinite(t)
            ? t
            : sortOrder === 'asc'
              ? Number.MAX_SAFE_INTEGER
              : Number.MIN_SAFE_INTEGER;
        };
        const aTs = toTs(a.invited_on);
        const bTs = toTs(b.invited_on);
        return sortOrder === 'asc' ? aTs - bTs : bTs - aTs;
      }
      const aStr =
        sortBy === 'email' ? a.invited_email.toLowerCase() : a.invited_role.name.toLowerCase();
      const bStr =
        sortBy === 'email' ? b.invited_email.toLowerCase() : b.invited_role.name.toLowerCase();
      return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return sorted;
  }, [invitations, emailFilter, roleFilters, dateFilter, sortBy, sortOrder]);

  // Render email filter
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

  // Render role filter
  const renderRoleFilter = () => (
    <PopoverContent className="w-80" align="start">
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Filter by Role</Label>
          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
            {uniqueRoles.map((roleName) => {
              const roleId = `role-${roleName.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
              return (
                <div key={roleName} className="flex items-center space-x-2">
                  <Checkbox
                    id={roleId}
                    checked={roleFilters.includes(roleName)}
                    onCheckedChange={(checked) =>
                      handleRoleFilterChange(roleName, checked as boolean)
                    }
                  />
                  <Label htmlFor={roleId} className="text-sm cursor-pointer">
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

  // Render date filter
  const renderDateFilter = () => (
    <PopoverContent className="w-80" align="start">
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Filter by Date</Label>
          <Select
            value={dateFilter}
            onValueChange={(value: 'all' | 'today' | 'week' | 'month') => setDateFilter(value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {dateFilter !== 'all' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDateFilter('all')}
            className="w-full"
          >
            Clear Date Filter
          </Button>
        )}
      </div>
    </PopoverContent>
  );

  const handleResendInvitation = async (invitationId: number) => {
    setResendingId(invitationId);
    try {
      await resendInvitation(invitationId);
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setResendingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {!invitations || invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No pending invitations</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-[35%]">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          className="h-auto p-0 font-medium text-base hover:bg-transparent flex-1"
                          onClick={() => handleSort('email')}
                        >
                          <div className="flex items-center gap-2">
                            Email
                            {renderSortIcon('email')}
                          </div>
                        </Button>
                        <Popover
                          open={openFilters.email}
                          onOpenChange={(open) =>
                            setOpenFilters((prev) => ({ ...prev, email: open }))
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0 hover:bg-gray-100"
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
                          className="h-auto p-0 font-medium text-base hover:bg-transparent flex-1"
                          onClick={() => handleSort('role')}
                        >
                          <div className="flex items-center gap-2">
                            Role
                            {renderSortIcon('role')}
                          </div>
                        </Button>
                        <Popover
                          open={openFilters.role}
                          onOpenChange={(open) =>
                            setOpenFilters((prev) => ({ ...prev, role: open }))
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0 hover:bg-gray-100"
                            >
                              {renderFilterIcon('role')}
                            </Button>
                          </PopoverTrigger>
                          {renderRoleFilter()}
                        </Popover>
                      </div>
                    </TableHead>
                    <TableHead className="w-[20%]">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          className="h-auto p-0 font-medium text-base hover:bg-transparent flex-1"
                          onClick={() => handleSort('sent_on')}
                        >
                          <div className="flex items-center gap-2">
                            Sent On
                            {renderSortIcon('sent_on')}
                          </div>
                        </Button>
                        <Popover
                          open={openFilters.date}
                          onOpenChange={(open) =>
                            setOpenFilters((prev) => ({ ...prev, date: open }))
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0 hover:bg-gray-100"
                            >
                              {renderFilterIcon('date')}
                            </Button>
                          </PopoverTrigger>
                          {renderDateFilter()}
                        </Popover>
                      </div>
                    </TableHead>
                    <TableHead className="w-[20%] text-right font-medium text-base">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedInvitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{invitation.invited_email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{invitation.invited_role.name}</Badge>
                      </TableCell>
                      <TableCell>
                        {invitation.invited_on &&
                        Number.isFinite(new Date(invitation.invited_on).getTime())
                          ? format(new Date(invitation.invited_on), 'MMM dd, yyyy')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {(canResendInvitation || canDeleteInvitation) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canResendInvitation && (
                                <DropdownMenuItem
                                  onClick={() => handleResendInvitation(invitation.id)}
                                  disabled={resendingId === invitation.id}
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  {resendingId === invitation.id ? 'Resending...' : 'Resend'}
                                </DropdownMenuItem>
                              )}
                              {canDeleteInvitation && (
                                <DropdownMenuItem
                                  onClick={() => setDeleteInvitation(invitation.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredAndSortedInvitations.length === 0 &&
                invitations &&
                invitations.length > 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No invitations match the current filters.{' '}
                    <Button variant="link" onClick={clearAllFilters} className="p-0 h-auto">
                      Clear all filters
                    </Button>
                  </div>
                )}
            </>
          )}
        </CardContent>
      </Card>

      <DeleteInvitationDialog
        open={!!deleteInvitation}
        onOpenChange={(open) => !open && setDeleteInvitation(null)}
        invitationId={deleteInvitation || 0}
        onSuccess={() => {
          mutate();
          setDeleteInvitation(null);
        }}
      />
    </>
  );
}
