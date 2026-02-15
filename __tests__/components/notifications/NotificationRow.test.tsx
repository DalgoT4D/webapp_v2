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

const longMessage =
  'This is a very long notification message that exceeds the truncation limit of 130 characters. It should be truncated and show an expand button for the user to see the full message content.';

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

    const expandButton = screen.getByRole('button');
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

    const buttons = screen.queryAllByRole('button');
    expect(buttons.length).toBe(0);
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

    const expandButton = screen.getByRole('button');
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
    const { container } = render(
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

    // Check for AlertCircle icon
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('does not display urgent indicator for non-urgent notifications', () => {
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

    // Check there's no AlertCircle icon (only chevron icons if message is long)
    const cells = container.querySelectorAll('td');
    const urgentCell = cells[2]; // Third cell is for urgent indicator
    const icon = urgentCell.querySelector('svg');
    expect(icon).not.toBeInTheDocument();
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

    const messageContainer = container.querySelector('.text-gray-500');
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

    const messageContainer = container.querySelector('.text-gray-900');
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
});
