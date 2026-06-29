import { act, renderHook } from '@testing-library/react';
import { useDashboardChat } from '@/hooks/api/useDashboardChat';

const mockSend = jest.fn();
let websocketOptions: {
  onMessage: (data: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
} | null = null;

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { selectedOrgSlug: string }) => string) =>
    selector({ selectedOrgSlug: 'acme' }),
}));

jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: (options: typeof websocketOptions) => {
    websocketOptions = options;
    return {
      isConnected: true,
      send: mockSend,
      error: null,
    };
  },
}));

describe('useDashboardChat', () => {
  beforeEach(() => {
    websocketOptions = null;
    mockSend.mockReset();
    mockSend.mockReturnValue(true);
  });

  it('streams progress and appends the final assistant message', () => {
    const { result } = renderHook(() => useDashboardChat({ dashboardId: 6, enabled: true }));

    act(() => {
      result.current.sendMessage('Top facilitators');
    });

    expect(mockSend).toHaveBeenCalledWith(expect.stringContaining('"action":"send_message"'));
    expect(result.current.isThinking).toBe(true);

    act(() => {
      websocketOptions?.onMessage(
        JSON.stringify({
          status: 'success',
          message: '',
          data: {
            event_type: 'progress',
            session_id: 'session-1',
            turn_id: 'turn-1',
            dashboard_id: 6,
            occurred_at: '2026-04-06T10:00:00.000Z',
            label: 'Loading dashboard context',
            stage: 'loading_context',
          },
        })
      );
    });

    expect(result.current.progressLabel).toBe('Loading dashboard context');

    act(() => {
      websocketOptions?.onMessage(
        JSON.stringify({
          status: 'success',
          message: '',
          data: {
            event_type: 'assistant_message',
            session_id: 'session-1',
            turn_id: 'turn-1',
            message_id: 'assistant-1',
            dashboard_id: 6,
            occurred_at: '2026-04-06T10:00:02.000Z',
            id: 'assistant-1',
            role: 'assistant',
            content: 'Here are the top facilitators.',
            created_at: '2026-04-06T10:00:02.000Z',
            payload: {
              citations: [],
              sql: 'select 1',
            },
          },
        })
      );
    });

    expect(result.current.isThinking).toBe(false);
    expect(result.current.progressLabel).toBeNull();
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].content).toBe('Here are the top facilitators.');
  });

  it('sends cancel_message for the active turn', () => {
    const { result } = renderHook(() => useDashboardChat({ dashboardId: 6, enabled: true }));

    act(() => {
      websocketOptions?.onMessage(
        JSON.stringify({
          status: 'success',
          message: '',
          data: {
            event_type: 'progress',
            session_id: 'session-1',
            turn_id: 'turn-1',
            dashboard_id: 6,
            occurred_at: '2026-04-06T10:00:00.000Z',
            label: 'Querying data',
            stage: 'querying_data',
          },
        })
      );
    });

    act(() => {
      result.current.cancelMessage();
    });

    expect(mockSend).toHaveBeenCalledWith(
      JSON.stringify({
        action: 'cancel_message',
        session_id: 'session-1',
        turn_id: 'turn-1',
      })
    );
    expect(result.current.isCancelling).toBe(true);
    expect(result.current.progressLabel).toBe('Stopping...');
  });

  it('does not queue a second user message while the first is still pending connection', () => {
    mockSend.mockReturnValue(false);

    const { result } = renderHook(() => useDashboardChat({ dashboardId: 6, enabled: true }));

    let firstSendAccepted = false;
    let secondSendAccepted = false;

    act(() => {
      firstSendAccepted = result.current.sendMessage('First question');
    });

    act(() => {
      secondSendAccepted = result.current.sendMessage('Second question');
    });

    expect(firstSendAccepted).toBe(true);
    expect(secondSendAccepted).toBe(false);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('First question');
    expect(result.current.error).toBe(
      'Wait for the current message to connect before sending another one'
    );
  });
});
