'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useInvitations, useInvitationActions } from '@/hooks/api/useUserManagement';
import { Mail, Send, Trash2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  ColumnHeader,
  ActionsCell,
  type ActionMenuItem,
  type SortState,
  type FilterState,
  type TextFilterValue,
  type DateFilterValue,
  type FilterConfig,
  type SkeletonConfig,
} from '@/components/ui/data-table';
import { DeleteInvitationDialog } from './DeleteInvitationDialog';

// Invitation type
interface Invitation {
  id: number;
  invited_email: string;
  invited_role: {
    name: string;
  };
  invited_on: string;
}

// Filter configurations
const filterConfigs: Record<string, FilterConfig> = {
  email: {
    type: 'text',
    placeholder: 'Search email...',
  },
  role: {
    type: 'checkbox',
  },
  sent_on: {
    type: 'date',
  },
};

// Skeleton configuration
const skeletonConfig: SkeletonConfig = {
  rowCount: 5,
  columns: [
    { width: 'w-[40%]', cellType: 'text' },
    { width: 'w-[25%]', cellType: 'badge' },
    { width: 'w-[20%]', cellType: 'text' },
    { width: 'w-[15%]', cellType: 'actions' },
  ],
};

// Initial filter state
const initialFilterState: FilterState = {
  email: { text: '' } as TextFilterValue,
  role: [] as string[],
  sent_on: { range: 'all', customStart: null, customEnd: null } as DateFilterValue,
};

export function InvitationsTable() {
  const { invitations, isLoading, error, mutate } = useInvitations();
  const { resendInvitation } = useInvitationActions();
  const { hasPermission } = useUserPermissions();

  const [deleteInvitation, setDeleteInvitation] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);

  // Sorting state
  const [sortState, setSortState] = useState<SortState>({
    column: 'sent_on',
    direction: 'desc',
  });

  // Filter state
  const [filterState, setFilterState] = useState<FilterState>(initialFilterState);

  const canDeleteInvitation = hasPermission('can_delete_invitation');
  const canResendInvitation = hasPermission('can_resend_email_verification');

  // Get unique roles for filter options
  const uniqueRoles = useMemo(() => {
    if (!invitations) return [];
    const roleSet = new Set(invitations.map((inv: Invitation) => inv.invited_role.name));
    return Array.from(roleSet)
      .sort()
      .map((r) => ({ value: r, label: r }));
  }, [invitations]);

  // Apply filters and sort invitations
  const filteredAndSortedInvitations = useMemo(() => {
    if (!invitations) return [];

    const emailFilter = filterState.email as TextFilterValue;
    const roleFilter = filterState.role as string[];
    const dateFilter = filterState.sent_on as DateFilterValue;

    // Apply filters
    const filtered = invitations.filter((invitation: Invitation) => {
      // Email filter
      if (emailFilter?.text) {
        if (!invitation.invited_email.toLowerCase().includes(emailFilter.text.toLowerCase())) {
          return false;
        }
      }

      // Role filter
      if (roleFilter.length > 0) {
        if (!roleFilter.includes(invitation.invited_role.name)) {
          return false;
        }
      }

      // Date filter
      if (dateFilter.range !== 'all' && invitation.invited_on) {
        const invitedDate = new Date(invitation.invited_on);
        const now = new Date();

        switch (dateFilter.range) {
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
          case 'custom': {
            if (dateFilter.customStart && invitedDate < dateFilter.customStart) return false;
            if (dateFilter.customEnd && invitedDate > dateFilter.customEnd) return false;
            break;
          }
        }
      }

      return true;
    });

    // Sort
    return [...filtered].sort((a: Invitation, b: Invitation) => {
      if (sortState.column === 'sent_on') {
        const toTs = (v: string) => {
          const t = new Date(v).getTime();
          return Number.isFinite(t)
            ? t
            : sortState.direction === 'asc'
              ? Number.MAX_SAFE_INTEGER
              : Number.MIN_SAFE_INTEGER;
        };
        const aTs = toTs(a.invited_on);
        const bTs = toTs(b.invited_on);
        return sortState.direction === 'asc' ? aTs - bTs : bTs - aTs;
      }

      const aStr =
        sortState.column === 'email'
          ? a.invited_email.toLowerCase()
          : a.invited_role.name.toLowerCase();
      const bStr =
        sortState.column === 'email'
          ? b.invited_email.toLowerCase()
          : b.invited_role.name.toLowerCase();

      return sortState.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [invitations, filterState, sortState]);

  // Get active filter count
  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    const emailFilter = filterState.email as TextFilterValue;
    if (emailFilter?.text) count++;
    if ((filterState.role as string[]).length > 0) count++;
    const dateFilter = filterState.sent_on as DateFilterValue;
    if (dateFilter?.range !== 'all') count++;
    return count;
  }, [filterState]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilterState(initialFilterState);
  }, []);

  // Resend invitation handler
  const handleResendInvitation = useCallback(
    async (invitationId: number) => {
      setResendingId(invitationId);
      try {
        await resendInvitation(invitationId);
      } catch {
        // Error is handled in the hook
      } finally {
        setResendingId(null);
      }
    },
    [resendInvitation]
  );

  // Define columns
  const columns: ColumnDef<Invitation>[] = useMemo(
    () => [
      {
        id: 'email',
        accessorKey: 'invited_email',
        header: () => (
          <ColumnHeader
            columnId="email"
            title="Email"
            sortable
            sortState={sortState}
            onSortChange={setSortState}
            filterConfig={filterConfigs.email}
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium truncate">{row.original.invited_email}</span>
          </div>
        ),
        meta: {
          headerClassName: 'w-[40%]',
          cellClassName: 'py-3',
        },
      },
      {
        id: 'role',
        accessorFn: (row) => row.invited_role.name,
        header: () => (
          <ColumnHeader
            columnId="role"
            title="Role"
            sortable
            sortState={sortState}
            onSortChange={setSortState}
            filterConfig={filterConfigs.role}
            filterState={filterState}
            onFilterChange={setFilterState}
            filterOptions={uniqueRoles}
          />
        ),
        cell: ({ row }) => <Badge variant="outline">{row.original.invited_role.name}</Badge>,
        meta: {
          headerClassName: 'w-[25%]',
          cellClassName: 'py-3',
        },
      },
      {
        id: 'sent_on',
        accessorKey: 'invited_on',
        header: () => (
          <ColumnHeader
            columnId="sent_on"
            title="Sent On"
            sortable
            sortState={sortState}
            onSortChange={setSortState}
            filterConfig={filterConfigs.sent_on}
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.invited_on && Number.isFinite(new Date(row.original.invited_on).getTime())
              ? format(new Date(row.original.invited_on), 'MMM dd, yyyy')
              : '—'}
          </span>
        ),
        meta: {
          headerClassName: 'w-[20%]',
          cellClassName: 'py-3',
        },
      },
      {
        id: 'actions',
        header: () => <span className="font-medium text-base">Actions</span>,
        cell: ({ row }) => {
          const invitation = row.original;

          if (!canResendInvitation && !canDeleteInvitation) {
            return null;
          }

          const actions: ActionMenuItem<Invitation>[] = [
            {
              id: 'resend',
              label: resendingId === invitation.id ? 'Resending...' : 'Resend',
              icon: <Send className="w-4 h-4" />,
              onClick: () => handleResendInvitation(invitation.id),
              disabled: resendingId === invitation.id,
              hidden: !canResendInvitation,
            },
            {
              id: 'delete',
              label: 'Delete',
              icon: <Trash2 className="w-4 h-4" />,
              variant: 'destructive',
              onClick: () => setDeleteInvitation(invitation.id),
              hidden: !canDeleteInvitation,
            },
          ];

          return <ActionsCell row={invitation} actions={actions} moreIconVariant="horizontal" />;
        },
        meta: {
          headerClassName: 'w-[15%]',
          cellClassName: 'py-3',
        },
      },
    ],
    [
      sortState,
      filterState,
      uniqueRoles,
      resendingId,
      canResendInvitation,
      canDeleteInvitation,
      handleResendInvitation,
    ]
  );

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load invitations</p>
        <Button variant="outline" onClick={() => mutate()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <DataTable
        data={filteredAndSortedInvitations}
        columns={columns}
        isLoading={isLoading}
        getRowId={(row) => row.id}
        sortState={sortState}
        onSortChange={setSortState}
        filterState={filterState}
        onFilterChange={setFilterState}
        filterConfigs={filterConfigs}
        activeFilterCount={getActiveFilterCount()}
        onClearAllFilters={clearAllFilters}
        emptyState={{
          icon: <Mail className="w-12 h-12" />,
          title: 'No pending invitations',
          filteredTitle: 'No invitations match the current filters',
        }}
        skeleton={skeletonConfig}
        idPrefix="invitations"
      />

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
