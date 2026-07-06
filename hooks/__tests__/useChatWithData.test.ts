/**
 * Chat turn state — pure reducer over WebSocket events.
 * Event shapes mirror DDP_backend ddpui/core/chat_with_data/runner.py.
 */

import {
  applyChatEvent,
  historyToChatMessages,
  newAssistantPlaceholder,
  newUserMessage,
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
