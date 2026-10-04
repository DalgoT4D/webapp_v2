import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Table, TableBody } from '@/components/ui/table';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PERMISSIONS } from '@/lib/rbac';
import { ChartListRow } from '@/components/charts/list/ChartListRow';
import { makeChart } from './chart-fixtures';

jest.mock('@/components/charts/ChartExportDropdownForList', () => ({
  ChartExportDropdownForList: (): null => null,
}));
jest.mock('@/components/charts/ChartDeleteDialog', () => ({
  ChartDeleteDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const renderRow = (overrides: Partial<React.ComponentProps<typeof ChartListRow>> = {}) => {
  const props: React.ComponentProps<typeof ChartListRow> = {
    chart: makeChart({
      id: 7,
      title: 'Enrolment',
      access_level: 'edit',
      created_by: 'ana@ngo.org',
      is_favorite: false,
    }),
    isSelectionMode: false,
    isSelected: false,
    isFavoriting: false,
    isDuplicating: false,
    isDeleting: false,
    hasPermission: () => true,
    onToggleFavorite: jest.fn(),
    onToggleSelection: jest.fn(),
    onEnterSelectionMode: jest.fn(),
    onShare: jest.fn(),
    onDuplicate: jest.fn(),
    onDelete: jest.fn(),
    ...overrides,
  };
  render(
    <TooltipProvider>
      <Table>
        <TableBody>
          <ChartListRow {...props} />
        </TableBody>
      </Table>
    </TooltipProvider>
  );
  return props;
};

describe('ChartListRow', () => {
  it('links the title, shows the source and creator, and edit/share for edit access', () => {
    renderRow();
    expect(screen.getByTestId('chart-list-title-link-7')).toHaveAttribute('href', '/charts/7');
    expect(screen.getByText('public.students')).toBeInTheDocument();
    expect(screen.getByTestId('chart-created-by-7')).toHaveTextContent('ana@ngo.org');
    expect(screen.getByTestId('chart-list-edit-7')).toBeInTheDocument();
    expect(screen.getByTestId('chart-list-share-7')).toBeInTheDocument();
  });

  it('without view permission the title goes nowhere; view access hides edit/share', () => {
    renderRow({
      chart: makeChart({ id: 7, access_level: 'view' }),
      hasPermission: (permission) => permission !== PERMISSIONS.CAN_VIEW_CHARTS,
    });
    expect(screen.getByTestId('chart-list-title-link-7')).toHaveAttribute('href', '#');
    expect(screen.queryByTestId('chart-list-edit-7')).toBeNull();
    expect(screen.queryByTestId('chart-list-share-7')).toBeNull();
  });

  it('star click toggles; the selection checkbox only shows in selection mode', () => {
    const props = renderRow({ isSelectionMode: true, isSelected: true });
    fireEvent.click(screen.getByTestId('chart-list-favorite-7'));
    expect(props.onToggleFavorite).toHaveBeenCalledWith(props.chart);
    fireEvent.click(screen.getByTestId('chart-select-checkbox-7'));
    expect(props.onToggleSelection).toHaveBeenCalledWith(7);
  });
});
