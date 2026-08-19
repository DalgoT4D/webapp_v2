import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from '../TabBar';
import type { DashboardTab } from '@/types/dashboard';

const makeTab = (id: string, title: string): DashboardTab => ({
  id,
  title,
  layout_config: [],
  components: {},
});

const defaultProps = {
  tabs: [makeTab('tab-1', 'Tab 1'), makeTab('tab-2', 'Tab 2')],
  activeTabId: 'tab-1',
  isEditMode: false,
  onTabChange: jest.fn(),
  onTabAdd: jest.fn(),
  onTabRemove: jest.fn(),
  onTabRename: jest.fn(),
  onTabReorder: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('TabBar', () => {
  it('renders all tabs', () => {
    render(<TabBar {...defaultProps} />);
    expect(screen.getByTestId('tab-item-tab-1')).toBeInTheDocument();
    expect(screen.getByTestId('tab-item-tab-2')).toBeInTheDocument();
    expect(screen.getByTestId('tab-item-tab-1')).toHaveAttribute('data-dashboard-tab-id', 'tab-1');
    expect(screen.getByTestId('tab-item-tab-1')).not.toHaveAttribute('aria-disabled');
    expect(screen.getByTestId('tab-title-tab-1')).toHaveAttribute('aria-label', 'Select Tab 1 tab');
  });

  it('uses adaptive-width tabs and highlights a cross-tab drop target', () => {
    render(<TabBar {...defaultProps} dragTargetTabId="tab-2" isWidgetDragging />);
    expect(screen.getByTestId('dashboard-tab-scroll')).toHaveClass(
      'overflow-x-auto',
      'overflow-y-hidden'
    );
    expect(screen.getByTestId('tab-item-tab-1')).toHaveClass('min-w-[120px]', 'flex-[0_1_auto]');
    expect(screen.getByTestId('tab-item-tab-2')).toHaveClass('ring-blue-300');
    expect(screen.queryByTestId('tab-remove-btn-tab-2')).not.toBeInTheDocument();
  });

  it('calls onTabChange when a tab is clicked', async () => {
    const user = userEvent.setup();
    render(<TabBar {...defaultProps} />);
    await user.click(screen.getByTestId('tab-item-tab-2'));
    expect(defaultProps.onTabChange).toHaveBeenCalledWith('tab-2');
  });

  it('does not show add button in view mode', () => {
    render(<TabBar {...defaultProps} isEditMode={false} />);
    expect(screen.queryByTestId('add-tab-btn')).not.toBeInTheDocument();
  });

  it('shows add button in edit mode and calls onTabAdd', async () => {
    const user = userEvent.setup();
    render(<TabBar {...defaultProps} isEditMode={true} />);
    await user.click(screen.getByTestId('add-tab-btn'));
    expect(defaultProps.onTabAdd).toHaveBeenCalledTimes(1);
    // add button sits inside the scroll area, immediately after the last tab
    const scroll = screen.getByTestId('dashboard-tab-scroll');
    const addBtn = screen.getByTestId('add-tab-btn');
    expect(scroll).toContainElement(addBtn);
    expect(scroll.lastElementChild).toBe(addBtn);
  });

  it('does not show remove button when only 1 tab', () => {
    render(<TabBar {...defaultProps} tabs={[makeTab('tab-1', 'Tab 1')]} isEditMode={true} />);
    expect(screen.queryByTestId('tab-remove-btn-tab-1')).not.toBeInTheDocument();
  });

  it('shows remove button in edit mode and confirms before removing', async () => {
    const user = userEvent.setup();
    render(<TabBar {...defaultProps} isEditMode={true} />);
    await user.click(screen.getByTestId('tab-remove-btn-tab-2'));
    // Confirm dialog should appear
    expect(screen.getByTestId('delete-tab-dialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('delete-tab-confirm-btn'));
    expect(defaultProps.onTabRemove).toHaveBeenCalledWith('tab-2');
  });

  it('renames tab on title click then Enter', async () => {
    const user = userEvent.setup();
    render(<TabBar {...defaultProps} isEditMode={true} />);
    await user.click(screen.getByTestId('tab-title-tab-1'));
    const input = screen.getByTestId('tab-rename-input-tab-1');
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.keyboard('{Enter}');
    expect(defaultProps.onTabRename).toHaveBeenCalledWith('tab-1', 'New Name');
  });

  it('renames the only tab on title click (single-tab dashboard)', async () => {
    const user = userEvent.setup();
    render(
      <TabBar
        {...defaultProps}
        tabs={[makeTab('tab-1', 'Tab 1')]}
        activeTabId="tab-1"
        isEditMode={true}
      />
    );
    await user.click(screen.getByTestId('tab-title-tab-1'));
    const input = screen.getByTestId('tab-rename-input-tab-1');
    await user.clear(input);
    await user.type(input, 'Renamed');
    await user.keyboard('{Enter}');
    expect(defaultProps.onTabRename).toHaveBeenCalledWith('tab-1', 'Renamed');
  });

  it('marks tabs as sortable in edit mode', () => {
    render(<TabBar {...defaultProps} isEditMode={true} />);
    const source = screen.getByTestId('tab-item-tab-1');
    expect(source).toHaveAttribute('aria-roledescription', 'reorderable dashboard tab');
    expect(source).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowLeft Alt+ArrowRight');
    expect(source).toHaveClass('cursor-grab');
    expect(source).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByTestId('tab-title-tab-1')).toHaveAttribute('aria-label', 'Rename Tab 1 tab');
  });

  it('reorders focused tabs with Alt+Arrow keys', () => {
    render(<TabBar {...defaultProps} isEditMode={true} />);
    fireEvent.keyDown(screen.getByTestId('tab-item-tab-1'), {
      key: 'ArrowRight',
      altKey: true,
    });
    expect(defaultProps.onTabReorder).toHaveBeenCalledWith('tab-1', 1);
  });

  it('disables tab reordering during a cross-tab widget drag', () => {
    render(<TabBar {...defaultProps} isEditMode={true} isWidgetDragging />);
    expect(screen.getByTestId('tab-item-tab-1')).not.toHaveAttribute('aria-roledescription');
    expect(screen.getByTestId('tab-item-tab-1')).not.toHaveAttribute('aria-keyshortcuts');
  });
});
