import { render, screen } from '@testing-library/react';
import ChatWithDataPage from '@/app/chat-with-data/page';
import { useChatWithDataStatus, useChatSessions } from '@/hooks/api/useChatSessions';
import type { ChatHistoryMessage, ChatMessage } from '@/types/chat-with-data';

jest.mock('@/hooks/api/useChatSessions', () => ({
  useChatWithDataStatus: jest.fn(),
  useChatSessions: jest.fn(),
  useChatSessionMessages: jest.fn(() => ({
    messages: [] as ChatHistoryMessage[],
    isLoading: false,
  })),
  createChatSession: jest.fn(),
  renameChatSession: jest.fn(),
  deleteChatSession: jest.fn(),
}));

jest.mock('@/hooks/useChatWithData', () => ({
  ...jest.requireActual('@/hooks/useChatWithData'),
  useChatWithData: jest.fn(() => ({
    messages: [] as ChatMessage[],
    sendMessage: jest.fn(),
    isStreaming: false,
    isConnected: true,
  })),
}));

const mockStatus = useChatWithDataStatus as jest.Mock;
const mockSessions = useChatSessions as jest.Mock;

describe('ChatWithDataPage', () => {
  beforeEach(() => {
    mockSessions.mockReturnValue({ sessions: [], isLoading: false, mutate: jest.fn() });
  });

  it('shows the consent empty state when the org has not opted in to AI', () => {
    mockStatus.mockReturnValue({
      status: { enabled: false, reason: 'llm_consent_required' },
      isLoading: false,
    });
    render(<ChatWithDataPage />);
    expect(screen.getByTestId('chat-blocked-state')).toBeInTheDocument();
    expect(screen.getByText('AI features need approval')).toBeInTheDocument();
  });

  it('shows the warehouse empty state when no warehouse is connected', () => {
    mockStatus.mockReturnValue({
      status: { enabled: false, reason: 'no_warehouse' },
      isLoading: false,
    });
    render(<ChatWithDataPage />);
    expect(screen.getByText('Connect a warehouse first')).toBeInTheDocument();
  });

  it('renders the chat surface when enabled', () => {
    mockStatus.mockReturnValue({
      status: { enabled: true, reason: 'ok' },
      isLoading: false,
    });
    render(<ChatWithDataPage />);
    expect(screen.getByTestId('chat-composer-input')).toBeInTheDocument();
    expect(screen.getByTestId('chat-new-session')).toBeInTheDocument();
  });
});
