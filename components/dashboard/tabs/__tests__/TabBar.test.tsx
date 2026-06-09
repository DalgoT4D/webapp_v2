import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from '../TabBar';
import { DashboardTab } from '@/types/dashboard';

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
};

beforeEach(() => jest.clearAllMocks());

describe('TabBar', () => {
  it('renders all tabs', () => {
    render(<TabBar {...defaultProps} />);
    expect(screen.getByTestId('tab-item-tab-1')).toBeInTheDocument();
    expect(screen.getByTestId('tab-item-tab-2')).toBeInTheDocument();
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
});
