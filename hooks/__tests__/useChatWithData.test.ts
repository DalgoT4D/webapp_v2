/**
 * Chat turn state — pure reducer over WebSocket events.
 * Event shapes mirror DDP_backend ddpui/core/chat_with_data/runner.py.
 */

import { renderHook, act } from '@testing-library/react';

jest.mock('@/hooks/useBackendWebSocket', () => ({
  useBackendWebSocket: () => ({ sendOrQueue: jest.fn(), isConnected: true }),
}));

import {
  applyChatEvent,
  historyToChatMessages,
  newAssistantPlaceholder,
  resolvePendingInput,
  newUserMessage,
  useChatWithData,
} from '../useChatWithData';
import type { ChatMessage } from '@/types/chat-with-data';

function startTurn(question: string): ChatMessage[] {
  return [newUserMessage(question), newAssistantPlaceholder()];
}

describe('applyChatEvent', () => {
  it('streams tokens into the pending assistant message', () => {
    let messages = startTurn('how many surveys?');
    messages = applyChatEvent(messages, { type: 'token', text: '1,284' });
    messages = applyChatEvent(messages, { type: 'token', text: ' surveys' });

    const assistant = messages[messages.length - 1];
    expect(assistant.role).toBe('assistant');
    expect(assistant.content).toBe('1,284 surveys');
    expect(assistant.streaming).toBe(true);
  });

  it('tracks tool activity through start and end, keeping the SQL for view-SQL', () => {
    let messages = startTurn('how many surveys?');
    messages = applyChatEvent(messages, {
      type: 'tool_start',
      tool: 'execute_sql',
      label: 'Running query…',
      sql: 'SELECT COUNT(*) FROM prod.surveys',
    });

    let assistant = messages[messages.length - 1];
    expect(assistant.tools).toEqual([
      {
        tool: 'execute_sql',
        label: 'Running query…',
        sql: 'SELECT COUNT(*) FROM prod.surveys',
        status: 'running',
      },
    ]);

    messages = applyChatEvent(messages, {
      type: 'tool_end',
      tool: 'execute_sql',
      status: 'success',
    });
    assistant = messages[messages.length - 1];
    expect(assistant.tools[0].status).toBe('success');
  });

  it('tool_end closes the most recent running activity when a tool ran twice', () => {
    let messages = startTurn('q');
    const start = { type: 'tool_start', tool: 'execute_sql', label: 'Running query…' } as const;
    messages = applyChatEvent(messages, { ...start, sql: 'SELECT bad' });
    messages = applyChatEvent(messages, { type: 'tool_end', tool: 'execute_sql', status: 'error' });
    messages = applyChatEvent(messages, { ...start, sql: 'SELECT good' });
    messages = applyChatEvent(messages, {
      type: 'tool_end',
      tool: 'execute_sql',
      status: 'success',
    });

    const assistant = messages[messages.length - 1];
    expect(assistant.tools.map((tool) => tool.status)).toEqual(['error', 'success']);
  });

  it('message_complete finalizes content and attaches the result table', () => {
    let messages = startTurn('how many surveys?');
    messages = applyChatEvent(messages, { type: 'token', text: 'partial' });
    messages = applyChatEvent(messages, {
      type: 'message_complete',
      message: '1,284 surveys in June.',
      result_table: { columns: ['count'], rows: [['1284']], row_count: 1 },
    });

    const assistant = messages[messages.length - 1];
    expect(assistant.content).toBe('1,284 surveys in June.');
    expect(assistant.streaming).toBe(false);
    expect(assistant.resultTable).toEqual({ columns: ['count'], rows: [['1284']], row_count: 1 });
  });

  it('error stops streaming and records a user-facing message', () => {
    let messages = startTurn('q');
    messages = applyChatEvent(messages, { type: 'error', message: 'Something went wrong' });

    const assistant = messages[messages.length - 1];
    expect(assistant.error).toBe('Something went wrong');
    expect(assistant.streaming).toBe(false);
  });

  it('ignores events when no assistant turn is pending', () => {
    const onlyUser = [newUserMessage('hello')];
    expect(applyChatEvent(onlyUser, { type: 'token', text: 'x' })).toEqual(onlyUser);
    expect(applyChatEvent([], { type: 'token', text: 'x' })).toEqual([]);
  });
});

describe('historyToChatMessages', () => {
  it('replays history bubbles with SQL attachments and the result table', () => {
    const messages = historyToChatMessages([
      { role: 'user', content: 'how many?', sql_attachments: [] },
      {
        role: 'assistant',
        content: '1,284 surveys.',
        sql_attachments: [
          { sql: 'SELECT bad', status: 'error' },
          {
            sql: 'SELECT COUNT(*) AS n FROM prod.surveys',
            status: 'success',
            row_count: 1,
            columns: ['n'],
            rows: [['1284']],
          },
        ],
      },
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].tools.map((tool) => tool.status)).toEqual(['error', 'success']);
    expect(messages[1].tools[1].sql).toContain('COUNT(*)');
    expect(messages[1].resultTable).toEqual({ columns: ['n'], rows: [['1284']], row_count: 1 });
    expect(messages[1].streaming).toBe(false);
  });
});

describe('created charts', () => {
  it('message_complete attaches created chart links', () => {
    let messages = [newUserMessage('chart it'), newAssistantPlaceholder()];
    messages = applyChatEvent(messages, {
      type: 'message_complete',
      message: 'Done — the chart is in your Charts page.',
      charts: [{ chart_id: 42, title: 'Surveys by district', url_path: '/charts/42' }],
    });
    const assistant = messages[messages.length - 1];
    expect(assistant.charts).toEqual([
      { chart_id: 42, title: 'Surveys by district', url_path: '/charts/42' },
    ]);
  });

  it('history replays chart links', () => {
    const out = historyToChatMessages([
      {
        role: 'assistant',
        content: 'Done.',
        sql_attachments: [],
        charts: [{ chart_id: 42, title: 'Surveys by district', url_path: '/charts/42' }],
      },
    ]);
    expect(out[0].charts).toEqual([
      { chart_id: 42, title: 'Surveys by district', url_path: '/charts/42' },
    ]);
  });
});

describe('validation events', () => {
  it('attaches a warn verdict and caveat to the answered message', () => {
    let messages = [newUserMessage('how many farmers?'), newAssistantPlaceholder()];
    messages = applyChatEvent(messages, { type: 'message_complete', message: '1,284 farmers.' });
    messages = applyChatEvent(messages, {
      type: 'validation',
      verdict: 'warn',
      caveat: 'This counts visit records, not unique farmers.',
    });
    const assistant = messages[messages.length - 1];
    expect(assistant.validation?.verdict).toBe('warn');
    expect(assistant.validation?.caveat).toContain('unique farmers');
  });
});

describe('session switching', () => {
  it('history still merges after a live turn in a previous session', () => {
    const history = [
      { id: 'h-0', role: 'user' as const, content: 'old question', streaming: false, tools: [] },
    ];

    const { result, rerender } = renderHook(
      ({ sessionId, initial }) =>
        useChatWithData(sessionId, { enabled: true, initialMessages: initial }),
      { initialProps: { sessionId: 1, initial: [] as typeof history } }
    );

    act(() => result.current.sendMessage('hello session one'));
    expect(result.current.messages.length).toBe(2); // user + placeholder

    // switch to session 2; its history arrives AFTER the switch
    rerender({ sessionId: 2, initial: [] });
    rerender({ sessionId: 2, initial: history });

    expect(result.current.messages).toEqual(history);
  });
});

describe('applyChatEvent input_required (human-in-the-loop)', () => {
  it('attaches a pending approval card and drops the never-started tool spinner', () => {
    let messages = startTurn('how many surveys?');
    messages = applyChatEvent(messages, {
      type: 'tool_start',
      tool: 'execute_sql',
      label: 'Running query…',
      sql: 'SELECT COUNT(*) FROM prod.surveys',
    });
    messages = applyChatEvent(messages, {
      type: 'input_required',
      kind: 'approval',
      requests: [
        {
          tool: 'execute_sql',
          args: { sql: 'SELECT COUNT(*) FROM prod.surveys' },
          description: 'Waiting for your go-ahead',
          sql: 'SELECT COUNT(*) FROM prod.surveys',
        },
      ],
    });

    const assistant = messages[messages.length - 1];
    expect(assistant.streaming).toBe(false);
    expect(assistant.inputRequest?.kind).toBe('approval');
    expect(assistant.inputRequest?.status).toBe('pending');
    // the gated query never ran — its running spinner must not linger
    expect(assistant.tools).toEqual([]);
  });

  it('renders an ask_user question as the assistant content', () => {
    let messages = startTurn('how many enrollments?');
    messages = applyChatEvent(messages, {
      type: 'input_required',
      kind: 'question',
      question: 'Which program do you mean?',
      requests: [
        { tool: 'ask_user', args: { question: 'Which program do you mean?' }, description: '' },
      ],
    });

    const assistant = messages[messages.length - 1];
    expect(assistant.content).toBe('Which program do you mean?');
    expect(assistant.inputRequest?.kind).toBe('question');
    expect(assistant.inputRequest?.status).toBe('pending');
  });

  it('appends an assistant bubble when the card is replayed after a reconnect', () => {
    // reconnect replay: history ends on the user's question, no live assistant bubble
    const messages = applyChatEvent([newUserMessage('how many?')], {
      type: 'input_required',
      kind: 'approval',
      requests: [{ tool: 'execute_sql', args: {}, description: '', sql: 'SELECT 1' }],
    });

    expect(messages).toHaveLength(2);
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].inputRequest?.status).toBe('pending');
  });
});

describe('resolvePendingInput', () => {
  it('settles pending cards and leaves decided ones alone', () => {
    const pending: ChatMessage = {
      ...newAssistantPlaceholder(),
      inputRequest: { kind: 'approval', requests: [], status: 'pending' },
    };
    const decided: ChatMessage = {
      ...newAssistantPlaceholder(),
      inputRequest: { kind: 'approval', requests: [], status: 'cancelled' },
    };
    const resolved = resolvePendingInput([pending, decided], 'approved');
    expect(resolved[0].inputRequest?.status).toBe('approved');
    expect(resolved[1].inputRequest?.status).toBe('cancelled');
  });
});
