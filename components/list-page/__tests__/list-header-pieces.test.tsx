import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SortableColumnHeader } from '@/components/list-page/SortableColumnHeader';
import { ColumnFilterPopover } from '@/components/list-page/ColumnFilterPopover';
import { ActiveFiltersSummary } from '@/components/list-page/ActiveFiltersSummary';
import { OptionCheckboxRow } from '@/components/list-page/OptionCheckboxRow';

describe('SortableColumnHeader', () => {
  const base = { label: 'Name', column: 'title' as const, onSort: jest.fn(), testId: 'sort-name' };

  it('shows the neutral icon when another column is sorted', () => {
    render(<SortableColumnHeader {...base} sortBy="updated_at" sortOrder="desc" />);
    const button = screen.getByTestId('sort-name');
    expect(button).toHaveTextContent('Name');
    expect(button.querySelector('svg')).toHaveClass('text-gray-400');
  });

  it('shows the active icon on the sorted column and calls onSort with the column', () => {
    const onSort = jest.fn();
    render(<SortableColumnHeader {...base} onSort={onSort} sortBy="title" sortOrder="asc" />);
    const button = screen.getByTestId('sort-name');
    expect(button.querySelector('svg')).toHaveClass('text-gray-600');
    fireEvent.click(button);
    expect(onSort).toHaveBeenCalledWith('title');
  });

  it('adds justify-start only when asked', () => {
    const { rerender } = render(<SortableColumnHeader {...base} sortBy="title" sortOrder="asc" />);
    expect(screen.getByTestId('sort-name')).not.toHaveClass('justify-start');
    rerender(<SortableColumnHeader {...base} sortBy="title" sortOrder="asc" justifyStart />);
    expect(screen.getByTestId('sort-name')).toHaveClass('justify-start');
  });
});

describe('ColumnFilterPopover', () => {
  const props = {
    onOpenChange: jest.fn(),
    triggerTestId: 'f-trigger',
    title: 'Filter by Name',
    clearTestId: 'f-clear',
    contentClassName: 'w-80',
  };

  it('shows the teal dot only when active', () => {
    const { rerender } = render(
      <ColumnFilterPopover {...props} isOpen={false} isActive={false} onClear={jest.fn()}>
        <span>body</span>
      </ColumnFilterPopover>
    );
    expect(screen.getByTestId('f-trigger').querySelector('.bg-teal-600')).toBeNull();
    rerender(
      <ColumnFilterPopover {...props} isOpen={false} isActive onClear={jest.fn()}>
        <span>body</span>
      </ColumnFilterPopover>
    );
    expect(screen.getByTestId('f-trigger').querySelector('.bg-teal-600')).not.toBeNull();
  });

  it('open: shows title, children and a Clear button that calls onClear', () => {
    const onClear = jest.fn();
    render(
      <ColumnFilterPopover {...props} isOpen isActive={false} onClear={onClear}>
        <span>body</span>
      </ColumnFilterPopover>
    );
    expect(screen.getByText('Filter by Name')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('f-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe('ActiveFiltersSummary', () => {
  it('renders nothing at 0', () => {
    const { container } = render(
      <ActiveFiltersSummary count={0} onClearAll={jest.fn()} clearTestId="clear-all" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('pluralizes and clears', () => {
    const onClearAll = jest.fn();
    const { rerender, container } = render(
      <ActiveFiltersSummary
        count={1}
        onClearAll={onClearAll}
        clearTestId="clear-all"
        id="charts-filters-section"
      />
    );
    expect(container.querySelector('#charts-filters-section')).toHaveTextContent('1 filter active');
    rerender(
      <ActiveFiltersSummary
        count={2}
        onClearAll={onClearAll}
        clearTestId="clear-all"
        countTestId="count"
      />
    );
    expect(screen.getByTestId('count')).toHaveTextContent('2 filters active');
    expect(container.querySelector('[id]')).toBeNull();
    fireEvent.click(screen.getByTestId('clear-all'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});

describe('OptionCheckboxRow', () => {
  it('toggles on row click and renders optional testids/classes', () => {
    const onToggle = jest.fn();
    const { rerender } = render(
      <OptionCheckboxRow
        label="bar"
        isChecked={false}
        onToggle={onToggle}
        testId="opt-bar"
        checkboxTestId="cb-bar"
        isCapitalized
      />
    );
    fireEvent.click(screen.getByTestId('opt-bar'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('cb-bar')).toBeInTheDocument();
    expect(screen.getByText('bar')).toHaveClass('capitalize');
    rerender(
      <OptionCheckboxRow label="owner@x.org" isChecked onToggle={onToggle} testId="opt-owner" />
    );
    expect(screen.getByText('owner@x.org')).not.toHaveClass('capitalize');
    expect(screen.queryByTestId('cb-bar')).toBeNull();
  });
});
