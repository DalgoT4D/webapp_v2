import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Table, TableBody } from '@/components/ui/table';
import type { OrgUser } from '@/stores/authStore';
import { DashboardListRow } from '@/components/dashboard/list/DashboardListRow';
import type { DashboardListItem } from '@/components/dashboard/list/dashboard-list-logic';

const dashboard = {
  id: 12,
  title: 'Sales Overview',
  created_by: 'ana@ngo.org',
  updated_at: '2026-01-01T00:00:00Z',
  is_locked: true,
  locked_by: 'ravi@ngo.org',
  is_favorite: false,
  access_level: 'edit',
} as DashboardListItem;

const renderRow = (currentUser: Partial<OrgUser>, patch: Partial<DashboardListItem> = {}) => {
  const onToggleFavorite = jest.fn();
  const onShare = jest.fn();
  render(
    <Table>
      <TableBody>
        <DashboardListRow
          dashboard={{ ...dashboard, ...patch }}
          currentUser={currentUser as OrgUser}
          hasPermission={() => true}
          isLandingPageLoading={false}
          isDuplicating={false}
          isDeleting={false}
          onToggleFavorite={onToggleFavorite}
          onShare={onShare}
          onSetMyLanding={jest.fn()}
          onRemoveMyLanding={jest.fn()}
          onMakeOrgDefault={jest.fn()}
          onDuplicate={jest.fn()}
          onDelete={jest.fn()}
        />
      </TableBody>
    </Table>
  );
  return { onToggleFavorite, onShare };
};

describe('DashboardListRow', () => {
  it('shows My Landing / Org Default badges and "Locked" when another user holds the lock', () => {
    renderRow({ email: 'ana@ngo.org', landing_dashboard_id: 12, org_default_dashboard_id: 12 });
    expect(screen.getByText('My Landing')).toBeInTheDocument();
    expect(screen.getByText('Org Default')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-list-title-link-12')).toHaveAttribute(
      'href',
      '/dashboards/12'
    );
  });

  it('shows "By You" for the lock holder; owner falls back to changed_by_name', () => {
    renderRow({ email: 'ravi@ngo.org' }, { created_by: '', changed_by_name: 'Ravi' });
    expect(screen.getByText('By You')).toBeInTheDocument();
    expect(screen.getByText('Ravi')).toBeInTheDocument();
  });

  it('star and share call back with the row', () => {
    const { onToggleFavorite, onShare } = renderRow({ email: 'ana@ngo.org' });
    fireEvent.click(screen.getByTestId('dashboard-list-favorite-12'));
    expect(onToggleFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }));
    fireEvent.click(screen.getByTestId('dashboard-share-table-12'));
    expect(onShare).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }));
  });
});
