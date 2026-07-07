import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardChat } from '@/components/dashboard/dashboard-chat';

const mockUseDashboardChat = jest.fn();
const mockUseDashboardChatBootstrap = jest.fn();

jest.mock('@/hooks/api/useDashboardChat', () => ({
  useDashboardChat: (args: unknown) => mockUseDashboardChat(args),
}));

jest.mock('@/hooks/api/useDashboardAIChat', () => ({
  useDashboardChatBootstrap: (args: unknown) => mockUseDashboardChatBootstrap(args),
}));

describe('DashboardChat', () => {
  beforeEach(() => {
    mockUseDashboardChat.mockReset();
    mockUseDashboardChatBootstrap.mockReset();
    mockUseDashboardChatBootstrap.mockReturnValue({
      bootstrap: {
        dashboard_id: 6,
        suggested_prompts: [
          'How did outcomes change by quarter?',
          'How does literacy efficiency compare across districts?',
          'What does the "Total Facilitators" metric represent?',
        ],
      },
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    });
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
      submitFeedback: jest.fn(),
      feedbackSubmittingById: {},
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
    expect(
      screen.getByText("Hi, I'm Dalgo AI. I can help you understand the data on this dashboard.")
    ).toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'How did outcomes change by quarter?' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stop generating' }));
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
          feedback: null,
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
      submitFeedback: jest.fn(),
      feedbackSubmittingById: {},
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
    expect(screen.getByText('Dalgo AI')).toBeInTheDocument();
    expect(sourceLink).toHaveAttribute(
      'href',
      '/explore?schema_name=analytics&table_name=facilitators'
    );

    await user.click(screen.getByRole('button', { name: /View SQL/i }));
    expect(
      screen.getByText('SELECT facilitator_name FROM analytics.facilitators')
    ).toBeInTheDocument();
  });

  it('sends a suggested prompt when the user clicks one', async () => {
    const user = userEvent.setup();
    const sendMessage = jest.fn().mockReturnValue(true);

    mockUseDashboardChat.mockReturnValue({
      messages: [],
      sessionId: null,
      isConnected: true,
      isThinking: false,
      isCancelling: false,
      progressLabel: null,
      error: null,
      sendMessage,
      cancelMessage: jest.fn(),
      submitFeedback: jest.fn(),
      feedbackSubmittingById: {},
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

    await user.click(screen.getByRole('button', { name: 'How did outcomes change by quarter?' }));

    expect(sendMessage).toHaveBeenCalledWith('How did outcomes change by quarter?');
  });

  it('focuses the input when the sidebar opens in an idle state', async () => {
    mockUseDashboardChat.mockReturnValue({
      messages: [],
      sessionId: null,
      isConnected: true,
      isThinking: false,
      isCancelling: false,
      progressLabel: null,
      error: null,
      sendMessage: jest.fn(),
      cancelMessage: jest.fn(),
      submitFeedback: jest.fn(),
      feedbackSubmittingById: {},
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

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Ask a question about this dashboard...')).toHaveFocus()
    );
  });

  it('renders locked thumbs feedback on assistant messages', async () => {
    const user = userEvent.setup();
    const submitFeedback = jest.fn();

    mockUseDashboardChat.mockReturnValue({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Top facilitators are listed below.',
          createdAt: '2026-04-06T10:00:00.000Z',
          feedback: null,
          payload: {
            citations: [],
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
      submitFeedback,
      feedbackSubmittingById: {},
      resetChat: jest.fn(),
    });

    const { rerender } = render(
      <DashboardChat
        dashboardId={6}
        dashboardTitle="Impact Overview"
        open={true}
        onOpenChange={jest.fn()}
        enabled={true}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Mark answer helpful' }));
    expect(submitFeedback).toHaveBeenCalledWith('assistant-1', 'thumbs_up');

    mockUseDashboardChat.mockReturnValue({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Top facilitators are listed below.',
          createdAt: '2026-04-06T10:00:00.000Z',
          feedback: 'thumbs_up',
          payload: {
            citations: [],
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
      submitFeedback,
      feedbackSubmittingById: {},
      resetChat: jest.fn(),
    });

    rerender(
      <DashboardChat
        dashboardId={6}
        dashboardTitle="Impact Overview"
        open={true}
        onOpenChange={jest.fn()}
        enabled={true}
      />
    );

    expect(screen.getByText('Feedback saved')).toBeInTheDocument();
  });
});
