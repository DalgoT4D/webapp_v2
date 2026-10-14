import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatWithDataPage from '@/app/chat-with-data/page';
import { useChatWithData } from '@/hooks/useChatWithData';
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

const mockReplace = jest.fn();
let mockSearch = '';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(mockSearch),
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
    mockSearch = '';
    mockReplace.mockClear();
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

  describe('thread in the URL', () => {
    const enabled = { status: { enabled: true, reason: 'ok' }, isLoading: false };
    const session = { id: 42, title: 'Districts', created_at: '', updated_at: '' };

    it('reopens the thread named in the URL after a reload', () => {
      mockStatus.mockReturnValue(enabled);
      mockSessions.mockReturnValue({ sessions: [session], isLoading: false, mutate: jest.fn() });
      mockSearch = 'session=42';
      render(<ChatWithDataPage />);

      expect(useChatWithData as jest.Mock).toHaveBeenLastCalledWith(42, expect.anything());
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('falls back to a new chat when the URL names a thread the user does not have', () => {
      mockStatus.mockReturnValue(enabled);
      mockSessions.mockReturnValue({ sessions: [session], isLoading: false, mutate: jest.fn() });
      mockSearch = 'session=999';
      render(<ChatWithDataPage />);

      expect(mockReplace).toHaveBeenCalledWith('/chat-with-data', { scroll: false });
    });

    it('puts the picked thread in the URL', async () => {
      mockStatus.mockReturnValue(enabled);
      mockSessions.mockReturnValue({ sessions: [session], isLoading: false, mutate: jest.fn() });
      render(<ChatWithDataPage />);

      await userEvent.click(screen.getByText('Districts'));
      expect(mockReplace).toHaveBeenCalledWith('/chat-with-data?session=42', { scroll: false });
    });
  });
});
