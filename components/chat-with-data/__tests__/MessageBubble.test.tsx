import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';
import type { ChatMessage } from '@/types/chat-with-data';

function message(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'm1',
    role: 'assistant',
    content: '',
    streaming: false,
    tools: [],
    ...overrides,
  };
}

describe('MessageBubble', () => {
  it('renders a user question', () => {
    render(<MessageBubble message={message({ role: 'user', content: 'How many surveys?' })} />);
    expect(screen.getByText('How many surveys?')).toBeInTheDocument();
  });

  it('renders an assistant answer with its result table', () => {
    render(
      <MessageBubble
        message={message({
          content: '1,284 surveys in June.',
          resultTable: { columns: ['count'], rows: [['1284']], row_count: 1 },
        })}
      />
    );
    expect(screen.getByText('1,284 surveys in June.')).toBeInTheDocument();
    expect(screen.getByTestId('chat-result-table')).toBeInTheDocument();
  });

  it('shows the error state instead of an empty answer', () => {
    render(<MessageBubble message={message({ error: 'Something went wrong.' })} />);
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
  });

  it('shows a thinking indicator while streaming with no content yet', () => {
    render(<MessageBubble message={message({ streaming: true })} />);
    expect(screen.getByTestId('chat-thinking')).toBeInTheDocument();
  });
});
