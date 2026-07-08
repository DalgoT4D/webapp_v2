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

  it('renders a link chip for a chart the agent created', () => {
    render(
      <MessageBubble
        message={message({
          content: 'Done — the chart is in your Charts page.',
          charts: [{ chart_id: 42, title: 'Surveys by district', url_path: '/charts/42' }],
        })}
      />
    );
    const chip = screen.getByTestId('chat-chart-link-42');
    expect(chip).toHaveAttribute('href', '/charts/42');
    expect(chip).toHaveTextContent('Surveys by district');
  });

  it('renders a dashboard chip with the dashboard icon', () => {
    render(
      <MessageBubble
        message={message({
          content: 'Added to your dashboard.',
          charts: [{ chart_id: 3, title: 'Donor Overview', url_path: '/dashboards/3' }],
        })}
      />
    );
    const chip = screen.getByTestId('chat-chart-link-3');
    expect(chip).toHaveAttribute('href', '/dashboards/3');
    expect(chip.querySelector('svg.lucide-layout-dashboard')).toBeInTheDocument();
  });

  it('shows an amber caveat strip when validation warns', () => {
    render(
      <MessageBubble
        message={message({
          content: '1,284 farmers.',
          validation: { verdict: 'warn', caveat: 'This counts visit records, not unique farmers.' },
        })}
      />
    );
    const strip = screen.getByTestId('chat-validation-caveat');
    expect(strip).toHaveTextContent('Worth checking');
    expect(strip).toHaveTextContent('unique farmers');
  });

  it('shows nothing extra when validation is ok', () => {
    render(
      <MessageBubble
        message={message({ content: 'All good.', validation: { verdict: 'ok', caveat: null } })}
      />
    );
    expect(screen.queryByTestId('chat-validation-caveat')).not.toBeInTheDocument();
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
