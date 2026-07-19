import { render, screen, waitFor } from '@testing-library/react';
import { ChatDrawer } from '../ChatDrawer';

const createChatSession = jest.fn();
jest.mock('@/hooks/api/useChatSessions', () => ({
  createChatSession: (...args: unknown[]) => createChatSession(...args),
}));

const useChatWithData = jest.fn();
jest.mock('@/hooks/useChatWithData', () => ({
  useChatWithData: (...args: unknown[]) => useChatWithData(...args),
}));

describe('ChatDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createChatSession.mockResolvedValue({
      id: 42,
      title: 'New chat',
      scope_type: 'dashboard',
      scope_id: 7,
    });
    useChatWithData.mockReturnValue({
      messages: [],
      isStreaming: false,
      sendMessage: jest.fn(),
    });
  });

  it('creates a dashboard-scoped session on open and renders the chat', async () => {
    render(
      <ChatDrawer
        dashboardId={7}
        dashboardTitle="Field Performance"
        open={true}
        onOpenChange={jest.fn()}
      />
    );

    await waitFor(() =>
      expect(createChatSession).toHaveBeenCalledWith({ scope_type: 'dashboard', scope_id: 7 })
    );
    // header names the dashboard and states the scope guarantee
    expect(screen.getByTestId('chat-drawer-title')).toHaveTextContent('Field Performance');
    expect(screen.getByTestId('chat-drawer-scope-hint')).toHaveTextContent("this dashboard's data");
    // the existing ChatPane is reused (its composer is the send box)
    await waitFor(() => expect(screen.getByTestId('chat-composer-input')).toBeInTheDocument());
  });

  it('does not create a session while closed', () => {
    render(
      <ChatDrawer
        dashboardId={7}
        dashboardTitle="Field Performance"
        open={false}
        onOpenChange={jest.fn()}
      />
    );
    expect(createChatSession).not.toHaveBeenCalled();
  });
});
