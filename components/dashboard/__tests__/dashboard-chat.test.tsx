import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardChat } from '@/components/dashboard/dashboard-chat';

const mockUseDashboardChat = jest.fn();

jest.mock('@/hooks/api/useDashboardChat', () => ({
  useDashboardChat: (args: unknown) => mockUseDashboardChat(args),
}));

describe('DashboardChat', () => {
  beforeEach(() => {
    mockUseDashboardChat.mockReset();
  });

  it('renders streamed progress text and lets the user stop the active turn', async () => {
    const user = userEvent.setup();
    const cancelMessage = jest.fn();

    mockUseDashboardChat.mockReturnValue({
      messages: [],
      sessionId: 'session-1',
      isConnected: true,
      isThinking: true,
      isCancelling: false,
      progressLabel: 'Querying data from analytics.sessions',
      error: null,
      sendMessage: jest.fn(),
      cancelMessage,
      resetChat: jest.fn(),
    });

    render(
      <DashboardChat
        dashboardId={6}
        dashboardTitle="Impact Overview"
        open={true}
        onOpenChange={jest.fn()}
        enabled={true}
      />
    );

    expect(screen.getByText('Querying data from analytics.sessions')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(cancelMessage).toHaveBeenCalledTimes(1);
  });

  it('renders clickable sources and expandable SQL for assistant replies', async () => {
    const user = userEvent.setup();

    mockUseDashboardChat.mockReturnValue({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Top facilitators are listed below.',
          createdAt: '2026-04-06T10:00:00.000Z',
          payload: {
            citations: [
              {
                source_type: 'warehouse_table',
                source_identifier: 'analytics.facilitators',
                title: 'Warehouse table: analytics.facilitators',
                snippet: 'SQL executed against analytics.facilitators.',
                url: '/explore?schema_name=analytics&table_name=facilitators',
              },
            ],
            sql: 'SELECT facilitator_name FROM analytics.facilitators',
          },
        },
      ],
      sessionId: 'session-1',
      isConnected: true,
      isThinking: false,
      isCancelling: false,
      progressLabel: null,
      error: null,
      sendMessage: jest.fn(),
      cancelMessage: jest.fn(),
      resetChat: jest.fn(),
    });

    render(
      <DashboardChat
        dashboardId={6}
        dashboardTitle="Impact Overview"
        open={true}
        onOpenChange={jest.fn()}
        enabled={true}
      />
    );

    const sourceLink = screen.getByRole('link', {
      name: 'Warehouse table: analytics.facilitators',
    });
    expect(sourceLink).toHaveAttribute(
      'href',
      '/explore?schema_name=analytics&table_name=facilitators'
    );

    await user.click(screen.getByRole('button', { name: /View SQL/i }));
    expect(
      screen.getByText('SELECT facilitator_name FROM analytics.facilitators')
    ).toBeInTheDocument();
  });
});
