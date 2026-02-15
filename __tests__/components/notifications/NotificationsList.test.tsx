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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders notifications correctly', () => {
    render(<NotificationsList {...defaultProps} />);

    expect(screen.getByText('First notification')).toBeInTheDocument();
    expect(screen.getByText('Second notification')).toBeInTheDocument();
    expect(screen.getByText('Third notification')).toBeInTheDocument();
  });

  it('displays correct notification count in header', () => {
    render(<NotificationsList {...defaultProps} />);

    expect(screen.getByText(/Showing 3 of 3 notifications/)).toBeInTheDocument();
  });

  it('shows empty state when no notifications', () => {
    render(<NotificationsList {...defaultProps} notifications={[]} totalCount={0} />);

    expect(screen.getByText('No notifications')).toBeInTheDocument();
    expect(
      screen.getByText("You're all caught up! Check back later for new notifications.")
    ).toBeInTheDocument();
  });

  it('handles select all checkbox', () => {
    const onSelectionChange = jest.fn();
    render(<NotificationsList {...defaultProps} onSelectionChange={onSelectionChange} />);

    // Find the select all checkbox (first checkbox in the header bar)
    const checkboxes = screen.getAllByRole('checkbox');
    const selectAllCheckbox = checkboxes[0];

    fireEvent.click(selectAllCheckbox);

    expect(onSelectionChange).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('handles individual selection', () => {
    const onSelectionChange = jest.fn();
    render(<NotificationsList {...defaultProps} onSelectionChange={onSelectionChange} />);

    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is select-all, second is first notification
    const firstNotificationCheckbox = checkboxes[1];

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
    render(<NotificationsList {...defaultProps} totalCount={30} page={1} pageSize={10} />);

    // Check pagination shows range (startItem-endItem based on page and pageSize)
    // page=1, pageSize=10, count=30 -> shows "1-10 of 30"
    expect(screen.getByText(/1-10 of 30/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    render(<NotificationsList {...defaultProps} totalCount={30} page={1} pageSize={10} />);

    const previousButton = screen.getByRole('button', { name: /previous/i });
    expect(previousButton).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<NotificationsList {...defaultProps} totalCount={30} page={3} pageSize={10} />);

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();
  });

  it('shows loading skeleton when isLoading is true', () => {
    render(<NotificationsList {...defaultProps} isLoading={true} />);

    // Should not show notifications when loading
    expect(screen.queryByText('First notification')).not.toBeInTheDocument();
  });

  it('shows pagination only when there are notifications', () => {
    const { rerender } = render(
      <NotificationsList {...defaultProps} notifications={[]} totalCount={0} />
    );

    // No pagination when empty
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();

    rerender(<NotificationsList {...defaultProps} />);

    // Pagination shows when there are notifications
    expect(screen.getByText('Previous')).toBeInTheDocument();
  });

  it('shows urgent indicator for urgent notifications', () => {
    render(<NotificationsList {...defaultProps} />);

    // Second notification is urgent
    const urgentIndicators = screen.getAllByLabelText('Urgent');
    expect(urgentIndicators.length).toBe(1);
  });

  it('applies different styling for read vs unread notifications', () => {
    render(<NotificationsList {...defaultProps} />);

    // Check that unread notifications have different styling
    // First and third are unread (read_status: false)
    const firstNotification = screen.getByText('First notification');
    const secondNotification = screen.getByText('Second notification');

    // Unread should have font-medium class
    expect(firstNotification.closest('p')).toHaveClass('font-medium');
    // Read should have text-slate-500 class on parent
    expect(secondNotification.closest('div')).toHaveClass('text-slate-500');
  });
});
