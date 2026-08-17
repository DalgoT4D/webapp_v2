import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPane } from '../ChatPane';
import type { ChatMessage } from '@/types/chat-with-data';

const conversation: ChatMessage[] = [
  { id: 'u1', role: 'user', content: 'How many surveys?', streaming: false, tools: [] },
  { id: 'a1', role: 'assistant', content: '1,284 surveys.', streaming: false, tools: [] },
];

describe('ChatPane', () => {
  it('renders the conversation', () => {
    render(<ChatPane messages={conversation} isStreaming={false} onSend={jest.fn()} />);
    expect(screen.getByText('How many surveys?')).toBeInTheDocument();
    expect(screen.getByText('1,284 surveys.')).toBeInTheDocument();
  });

  it('sends the composed question and clears the input', () => {
    const onSend = jest.fn();
    render(<ChatPane messages={[]} isStreaming={false} onSend={onSend} />);

    const input = screen.getByTestId('chat-composer-input');
    fireEvent.change(input, { target: { value: 'surveys in Pune?' } });
    fireEvent.click(screen.getByTestId('chat-composer-send'));

    expect(onSend).toHaveBeenCalledWith('surveys in Pune?');
    expect((input as HTMLTextAreaElement).value).toBe('');
  });

  it('disables sending while a turn is streaming', () => {
    render(<ChatPane messages={conversation} isStreaming={true} onSend={jest.fn()} />);
    expect(screen.getByTestId('chat-composer-send')).toBeDisabled();
  });

  it('shows a friendly empty state before the first question', () => {
    render(<ChatPane messages={[]} isStreaming={false} onSend={jest.fn()} />);
    expect(screen.getByTestId('chat-empty-state')).toBeInTheDocument();
  });
});
