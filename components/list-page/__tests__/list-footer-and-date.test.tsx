import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DateModifiedFilter } from '@/components/list-page/DateModifiedFilter';
import { ListPagination } from '@/components/list-page/ListPagination';
import {
  createEmptyDateFilter,
  type DateFilter,
  type DateInputMode,
} from '@/components/list-page/list-logic';

function DateHarness({ mode }: { mode: DateInputMode }) {
  const [value, setValue] = useState<DateFilter>(createEmptyDateFilter());
  return (
    <>
      <DateModifiedFilter
        value={value}
        onChange={setValue}
        optionTestIdPrefix="t-date"
        fromTestId="t-from"
        toTestId="t-to"
        dateInputMode={mode}
      />
      <output data-testid="state">{JSON.stringify(value)}</output>
    </>
  );
}

describe('DateModifiedFilter', () => {
  it('renders the five ranges with "All time" checked', () => {
    render(<DateHarness mode="iso-date" />);
    ['all', 'today', 'week', 'month', 'custom'].forEach((v) =>
      expect(screen.getByTestId(`t-date-${v}`)).toBeInTheDocument()
    );
    expect(screen.getByTestId('t-date-all')).toBeChecked();
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.queryByTestId('t-from')).toBeNull();
  });

  it('custom range shows From/To; iso-date stores UTC midnight', () => {
    render(<DateHarness mode="iso-date" />);
    fireEvent.click(screen.getByTestId('t-date-custom'));
    fireEvent.change(screen.getByTestId('t-from'), { target: { value: '2026-03-05' } });
    expect(JSON.parse(screen.getByTestId('state').textContent ?? '{}').customStart).toBe(
      '2026-03-05T00:00:00.000Z'
    );
    expect(screen.getByTestId('t-from')).toHaveValue('2026-03-05');
  });

  it('local-date round-trips the typed day', () => {
    render(<DateHarness mode="local-date" />);
    fireEvent.click(screen.getByTestId('t-date-custom'));
    fireEvent.change(screen.getByTestId('t-to'), { target: { value: '2026-03-05' } });
    expect(screen.getByTestId('t-to')).toHaveValue('2026-03-05');
    fireEvent.change(screen.getByTestId('t-to'), { target: { value: '' } });
    expect(JSON.parse(screen.getByTestId('state').textContent ?? '{}').customEnd).toBeNull();
  });
});

describe('ListPagination', () => {
  const testIds = {
    pageSizeTrigger: 'size',
    pageSizeOptionPrefix: 'size-option',
    prev: 'prev',
    next: 'next',
    itemCount: 'count',
    pageCounter: 'counter',
  };

  it('shows range and page counter; Prev/Next call onPageChange', () => {
    const onPageChange = jest.fn();
    render(
      <ListPagination
        currentPage={2}
        pageSize={10}
        total={45}
        totalPages={5}
        onPageChange={onPageChange}
        onPageSizeChange={jest.fn()}
        testIds={testIds}
      />
    );
    expect(screen.getByTestId('count')).toHaveTextContent('11–20 of 45');
    expect(screen.getByTestId('counter')).toHaveTextContent('2 of 5');
    fireEvent.click(screen.getByTestId('next'));
    expect(onPageChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByTestId('prev'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('disables Prev on page 1 and Next on/after the last page ("2 of 1" keeps Next disabled)', () => {
    const { rerender } = render(
      <ListPagination
        currentPage={1}
        pageSize={10}
        total={5}
        totalPages={1}
        onPageChange={jest.fn()}
        onPageSizeChange={jest.fn()}
        testIds={testIds}
      />
    );
    expect(screen.getByTestId('prev')).toBeDisabled();
    expect(screen.getByTestId('next')).toBeDisabled();
    rerender(
      <ListPagination
        currentPage={2}
        pageSize={10}
        total={10}
        totalPages={1}
        onPageChange={jest.fn()}
        onPageSizeChange={jest.fn()}
        testIds={testIds}
      />
    );
    expect(screen.getByTestId('counter')).toHaveTextContent('2 of 1');
    expect(screen.getByTestId('count')).toHaveTextContent('11–10 of 10');
    expect(screen.getByTestId('prev')).toBeEnabled();
    expect(screen.getByTestId('next')).toBeDisabled();
  });

  it('renders the charts/dashboards ids only when idPrefix is given', () => {
    const { container, rerender } = render(
      <ListPagination
        currentPage={1}
        pageSize={10}
        total={0}
        totalPages={1}
        onPageChange={jest.fn()}
        onPageSizeChange={jest.fn()}
        idPrefix="charts"
        testIds={testIds}
      />
    );
    [
      'pagination-footer',
      'pagination-info',
      'page-size-label',
      'prev-page-button',
      'page-info',
      'next-page-button',
    ].forEach((suffix) => expect(container.querySelector(`#charts-${suffix}`)).not.toBeNull());
    expect(screen.getByTestId('count')).toHaveTextContent('0–0 of 0');
    rerender(
      <ListPagination
        currentPage={1}
        pageSize={10}
        total={0}
        totalPages={1}
        onPageChange={jest.fn()}
        onPageSizeChange={jest.fn()}
        testIds={testIds}
      />
    );
    expect(container.querySelector('[id$="pagination-footer"]')).toBeNull();
  });
});
