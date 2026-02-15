import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationRow } from '@/components/notifications/NotificationRow';
import { Notification } from '@/types/notifications';

const mockNotification: Notification = {
  id: 1,
  urgent: false,
  author: 'System',
  message: 'This is a test notification message',
  read_status: false,
  timestamp: new Date().toISOString(),
};

// Must exceed 300 characters to trigger truncation
const longMessage =
  'This is a very long notification message that exceeds the truncation limit of 300 characters. It should be truncated and show an expand button for the user to see the full message content. This message needs to be really long to trigger the truncation behavior, so we are adding more text here to make sure it exceeds the threshold that was set in the constants file.';

describe('NotificationRow', () => {
  it('renders notification message correctly', () => {
    render(
      <table>
        <tbody>
          <NotificationRow
            notification={mockNotification}
            isSelected={false}
            isExpanded={false}
            onSelect={jest.fn()}
            onToggleExpand={jest.fn()}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText(mockNotification.message)).toBeInTheDocument();
  });

  it('truncates long messages', () => {
    const longNotification = { ...mockNotification, message: longMessage };
    render(
      <table>
        <tbody>
          <NotificationRow
            notification={longNotification}
            isSelected={false}
            isExpanded={false}
            onSelect={jest.fn()}
            onToggleExpand={jest.fn()}
          />
        </tbody>
      </table>
    );

    const displayedText = screen.getByText(/This is a very long notification message/);
    expect(displayedText.textContent).toContain('...');
    expect(displayedText.textContent?.length).toBeLessThan(longMessage.length);
  });

  it('shows expand button for long messages', () => {
    const longNotification = { ...mockNotification, message: longMessage };
    render(
      <table>
        <tbody>
          <NotificationRow
            notification={longNotification}
            isSelected={false}
            isExpanded={false}
            onSelect={jest.fn()}
            onToggleExpand={jest.fn()}
          />
        </tbody>
      </table>
    );

    const expandButton = screen.getByRole('button', { name: /expand message/i });
    expect(expandButton).toBeInTheDocument();
  });

  it('does not show expand button for short messages', () => {
    render(
      <table>
        <tbody>
          <NotificationRow
            notification={mockNotification}
            isSelected={false}
            isExpanded={false}
            onSelect={jest.fn()}
            onToggleExpand={jest.fn()}
          />
        </tbody>
      </table>
    );

    const expandButton = screen.queryByRole('button', { name: /expand message/i });
    expect(expandButton).not.toBeInTheDocument();
  });

  it('expands message on button click', () => {
    const longNotification = { ...mockNotification, message: longMessage };
    const onToggleExpand = jest.fn();

    const { rerender } = render(
      <table>
        <tbody>
          <NotificationRow
            notification={longNotification}
            isSelected={false}
            isExpanded={false}
            onSelect={jest.fn()}
            onToggleExpand={onToggleExpand}
          />
        </tbody>
      </table>
    );

    const expandButton = screen.getByRole('button', { name: /expand message/i });
    fireEvent.click(expandButton);

    expect(onToggleExpand).toHaveBeenCalledWith(longNotification.id);

    // Simulate expanded state
    rerender(
      <table>
        <tbody>
          <NotificationRow
            notification={longNotification}
            isSelected={false}
            isExpanded={true}
            onSelect={jest.fn()}
            onToggleExpand={onToggleExpand}
          />
        </tbody>
      </table>
    );

    const displayedText = screen.getByText(longMessage);
    expect(displayedText.textContent).toBe(longMessage);
  });

  it('displays urgent indicator for urgent notifications', () => {
    const urgentNotification = { ...mockNotification, urgent: true };
    render(
      <table>
        <tbody>
          <NotificationRow
            notification={urgentNotification}
            isSelected={false}
            isExpanded={false}
            onSelect={jest.fn()}
            onToggleExpand={jest.fn()}
          />
        </tbody>
      </table>
    );

    const urgentIcon = screen.getByLabelText('Urgent');
    expect(urgentIcon).toBeInTheDocument();
  });

  it('does not display urgent indicator for non-urgent notifications', () => {
    render(
      <table>
        <tbody>
          <NotificationRow
            notification={mockNotification}
            isSelected={false}
            isExpanded={false}
            onSelect={jest.fn()}
            onToggleExpand={jest.fn()}
          />
        </tbody>
      </table>
    );

    const urgentIcon = screen.queryByLabelText('Urgent');
    expect(urgentIcon).not.toBeInTheDocument();
  });

  it('applies correct styling for read notifications', () => {
    const readNotification = { ...mockNotification, read_status: true };
    const { container } = render(
      <table>
        <tbody>
          <NotificationRow
            notification={readNotification}
            isSelected={false}
            isExpanded={false}
            onSelect={jest.fn()}
            onToggleExpand={jest.fn()}
          />
        </tbody>
      </table>
    );

    const messageContainer = container.querySelector('.text-slate-500');
    expect(messageContainer).toBeInTheDocument();
  });

  it('applies correct styling for unread notifications', () => {
    const { container } = render(
      <table>
        <tbody>
          <NotificationRow
            notification={mockNotification}
            isSelected={false}
            isExpanded={false}
            onSelect={jest.fn()}
            onToggleExpand={jest.fn()}
          />
        </tbody>
      </table>
    );

    const messageContainer = container.querySelector('.text-slate-800');
    expect(messageContainer).toBeInTheDocument();
  });

  it('calls onSelect when checkbox is clicked', () => {
    const onSelect = jest.fn();
    render(
      <table>
        <tbody>
          <NotificationRow
            notification={mockNotification}
            isSelected={false}
            isExpanded={false}
            onSelect={onSelect}
            onToggleExpand={jest.fn()}
          />
        </tbody>
      </table>
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(onSelect).toHaveBeenCalledWith(mockNotification.id, true);
  });

  it('formats timestamp as relative time', () => {
    render(
      <table>
        <tbody>
          <NotificationRow
            notification={mockNotification}
            isSelected={false}
            isExpanded={false}
            onSelect={jest.fn()}
            onToggleExpand={jest.fn()}
          />
        </tbody>
      </table>
    );

    // Should show relative time like "X seconds ago"
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it('renders links in messages as clickable', () => {
    const notificationWithLink = {
      ...mockNotification,
      message: 'Check this link: https://example.com/test for more info',
    };
    render(
      <table>
        <tbody>
          <NotificationRow
            notification={notificationWithLink}
            isSelected={false}
            isExpanded={false}
            onSelect={jest.fn()}
            onToggleExpand={jest.fn()}
          />
        </tbody>
      </table>
    );

    const link = screen.getByRole('link', { name: 'https://example.com/test' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/test');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
