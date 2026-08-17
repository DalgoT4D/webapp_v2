import { render, screen, fireEvent } from '@testing-library/react';
import { SessionSidebar } from '../SessionSidebar';
import type { ChatSession } from '@/types/chat-with-data';

const sessions: ChatSession[] = [
  { id: 2, title: 'Water surveys', scope_type: 'org', created_at: 'c2', updated_at: 'u2' },
  { id: 1, title: 'Pune attendance', scope_type: 'org', created_at: 'c1', updated_at: 'u1' },
];

describe('SessionSidebar', () => {
  it('lists sessions and marks the active one', () => {
    render(
      <SessionSidebar
        sessions={sessions}
        activeSessionId={2}
        onSelect={jest.fn()}
        onNewChat={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(screen.getByText('Water surveys')).toBeInTheDocument();
    expect(screen.getByText('Pune attendance')).toBeInTheDocument();
    expect(screen.getByTestId('chat-session-2')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('chat-session-1')).toHaveAttribute('data-active', 'false');
  });

  it('selects a session and starts a new chat', () => {
    const onSelect = jest.fn();
    const onNewChat = jest.fn();
    render(
      <SessionSidebar
        sessions={sessions}
        activeSessionId={null}
        onSelect={onSelect}
        onNewChat={onNewChat}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('Pune attendance'));
    expect(onSelect).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByTestId('chat-new-session'));
    expect(onNewChat).toHaveBeenCalled();
  });
});
