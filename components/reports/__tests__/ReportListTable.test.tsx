import React from 'react';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { ReportListTable } from '@/components/reports/list/ReportListTable';
import { useReportListFilters } from '@/components/reports/list/useReportListFilters';
import { createMockSnapshot } from './report-mock-data';

const setup = (
  snapshots = [createMockSnapshot({ id: 1, title: 'Q1', dashboard_title: undefined })]
) => {
  const { result } = renderHook(() => useReportListFilters(jest.fn()));
  const handlers = {
    onSort: jest.fn(),
    onOpenReport: jest.fn(),
    onShare: jest.fn(),
    onEmail: jest.fn(),
    onDelete: jest.fn(),
  };
  render(
    <ReportListTable
      snapshots={snapshots}
      sortBy="created_at"
      sortOrder="desc"
      filters={result.current}
      canDelete
      {...handlers}
    />
  );
  return handlers;
};

describe('ReportListTable', () => {
  it('row click opens the report; the actions cell does not', () => {
    const { onOpenReport, onShare } = setup();
    fireEvent.click(screen.getByTestId('report-row-1'));
    expect(onOpenReport).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByTestId('report-share-1'));
    expect(onShare).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(onOpenReport).toHaveBeenCalledTimes(1);
  });

  it('missing dashboard shows "—"; Created on has no filter trigger', () => {
    const { onSort } = setup();
    expect(screen.getByTestId('report-row-dashboard-1')).toHaveTextContent('—');
    fireEvent.click(screen.getByTestId('report-list-sort-created-on'));
    expect(onSort).toHaveBeenCalledWith('created_at');
    expect(screen.getByTestId('report-filter-title-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('report-filter-created-on-trigger')).toBeNull();
  });

  it('no rows → the no-match row', () => {
    setup([]);
    expect(screen.getByTestId('report-list-no-match')).toHaveTextContent(
      'No reports match the current filters'
    );
  });
});
