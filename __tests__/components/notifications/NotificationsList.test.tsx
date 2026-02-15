import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationsList } from '@/components/notifications/NotificationsList';
import { Notification } from '@/types/notifications';

const mockNotifications: Notification[] = [
  {
    id: 1,
    urgent: false,
    author: 'System',
    message: 'First notification',
    read_status: false,
    timestamp: new Date().toISOString(),
  },
  {
    id: 2,
    urgent: true,
    author: 'Admin',
    message: 'Second notification',
    read_status: true,
    timestamp: new Date().toISOString(),
  },
  {
    id: 3,
    urgent: false,
    author: 'User',
    message: 'Third notification',
    read_status: false,
    timestamp: new Date().toISOString(),
  },
];

describe('NotificationsList', () => {
  const defaultProps = {
    notifications: mockNotifications,
    totalCount: 3,
    selectedIds: [],
    onSelectionChange: jest.fn(),
    page: 1,
    pageSize: 10,
    onPageChange: jest.fn(),
    onPageSizeChange: jest.fn(),
  };

  it('renders notifications correctly', () => {
    render(<NotificationsList {...defaultProps} />);

    expect(screen.getByText('First notification')).toBeInTheDocument();
    expect(screen.getByText('Second notification')).toBeInTheDocument();
    expect(screen.getByText('Third notification')).toBeInTheDocument();
  });

  it('displays correct notification count', () => {
    render(<NotificationsList {...defaultProps} />);

    expect(screen.getByText('Showing 3 of 3 notifications')).toBeInTheDocument();
  });

  it('shows empty state when no notifications', () => {
    render(<NotificationsList {...defaultProps} notifications={[]} totalCount={0} />);

    expect(screen.getByText('No notifications to display')).toBeInTheDocument();
  });

  it('handles select all checkbox', () => {
    const onSelectionChange = jest.fn();
    render(<NotificationsList {...defaultProps} onSelectionChange={onSelectionChange} />);

    const checkboxes = screen.getAllByRole('checkbox');
    const selectAllCheckbox = checkboxes[0];

    fireEvent.click(selectAllCheckbox);

    expect(onSelectionChange).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('handles individual selection', () => {
    const onSelectionChange = jest.fn();
    render(<NotificationsList {...defaultProps} onSelectionChange={onSelectionChange} />);

    const checkboxes = screen.getAllByRole('checkbox');
    const firstNotificationCheckbox = checkboxes[1]; // First checkbox after select-all

    fireEvent.click(firstNotificationCheckbox);

    expect(onSelectionChange).toHaveBeenCalledWith([1]);
  });

  it('deselects all when select all is unchecked', () => {
    const onSelectionChange = jest.fn();
    render(
      <NotificationsList
        {...defaultProps}
        selectedIds={[1, 2, 3]}
        onSelectionChange={onSelectionChange}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    const selectAllCheckbox = checkboxes[0];

    fireEvent.click(selectAllCheckbox);

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('removes individual selection when checkbox is unchecked', () => {
    const onSelectionChange = jest.fn();
    render(
      <NotificationsList
        {...defaultProps}
        selectedIds={[1, 2]}
        onSelectionChange={onSelectionChange}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    const firstNotificationCheckbox = checkboxes[1];

    fireEvent.click(firstNotificationCheckbox);

    expect(onSelectionChange).toHaveBeenCalledWith([2]);
  });

  it('handles pagination controls', () => {
    const onPageChange = jest.fn();
    const onPageSizeChange = jest.fn();

    render(
      <NotificationsList
        {...defaultProps}
        totalCount={30}
        page={1}
        pageSize={10}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    // Check pagination is rendered
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    render(<NotificationsList {...defaultProps} totalCount={30} page={1} pageSize={10} />);

    const previousButton = screen.getByText('Previous');
    expect(previousButton).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<NotificationsList {...defaultProps} totalCount={30} page={3} pageSize={10} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('renders table headers correctly', () => {
    render(<NotificationsList {...defaultProps} />);

    expect(screen.getByText('Message')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('shows pagination only when there are notifications', () => {
    const { rerender } = render(
      <NotificationsList {...defaultProps} notifications={[]} totalCount={0} />
    );

    expect(screen.queryByText('Page 1 of 1')).not.toBeInTheDocument();

    rerender(<NotificationsList {...defaultProps} />);

    expect(screen.getByText(/Page \d+ of \d+/)).toBeInTheDocument();
  });
});
