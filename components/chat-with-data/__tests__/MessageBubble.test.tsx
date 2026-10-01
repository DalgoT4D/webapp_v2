import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageBubble } from '../MessageBubble';
import type { ChatMessage, PiiColumn } from '@/types/chat-with-data';

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
          artifacts: [
            { type: 'chart', object_id: 42, title: 'Surveys by district', url_path: '/charts/42' },
          ],
        })}
      />
    );
    const chip = screen.getByTestId('chat-artifact-link-chart-42');
    expect(chip).toHaveAttribute('href', '/charts/42');
    expect(chip).toHaveTextContent('Surveys by district');
  });

  it('renders a dashboard chip with the dashboard icon', () => {
    render(
      <MessageBubble
        message={message({
          content: 'Added to your dashboard.',
          artifacts: [
            { type: 'dashboard', object_id: 3, title: 'Donor Overview', url_path: '/dashboards/3' },
          ],
        })}
      />
    );
    const chip = screen.getByTestId('chat-artifact-link-dashboard-3');
    expect(chip).toHaveAttribute('href', '/dashboards/3');
    expect(chip.querySelector('svg.lucide-layout-dashboard')).toBeInTheDocument();
  });

  it('labels a metric chip by its type, not as a chart', () => {
    render(
      <MessageBubble
        message={message({
          content: 'Created the metric.',
          artifacts: [
            { type: 'metric', object_id: 5, title: 'Total surveys', url_path: '/metrics' },
          ],
        })}
      />
    );
    const chip = screen.getByTestId('chat-artifact-link-metric-5');
    expect(chip).toHaveAttribute('href', '/metrics');
    expect(chip).toHaveTextContent('Open in Metrics');
    expect(chip.querySelector('svg.lucide-sigma')).toBeInTheDocument();
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

  it('renders assistant markdown (bold, bullets) as rich text', () => {
    render(
      <MessageBubble
        message={message({ content: 'You ran **1,284 surveys** in June.\n\n- Pune — **700**' })}
      />
    );
    expect(screen.getByText('1,284 surveys').tagName).toBe('STRONG');
    expect(screen.getByRole('listitem')).toHaveTextContent('Pune — 700');
  });

  it('leaves user messages as literal text — no markdown rendering', () => {
    render(<MessageBubble message={message({ role: 'user', content: 'what is **this**?' })} />);
    expect(screen.getByText('what is **this**?')).toBeInTheDocument();
    expect(document.querySelector('strong')).toBeNull();
  });
});

describe('MessageBubble human-in-the-loop', () => {
  const approvalMessage = message({
    inputRequest: {
      kind: 'approval',
      status: 'pending',
      requests: [
        {
          tool: 'execute_sql',
          args: { sql: 'SELECT COUNT(*) FROM prod.surveys' },
          description: 'Waiting for your go-ahead',
          sql: 'SELECT COUNT(*) FROM prod.surveys',
        },
      ],
    },
  });

  it('renders the approval card with the SQL and fires the callbacks', () => {
    const respond = jest.fn();
    render(<MessageBubble message={approvalMessage} onApprovalRespond={respond} />);

    expect(screen.getByTestId('chat-approval-card')).toBeInTheDocument();
    expect(screen.getByText('Run this query on your data warehouse?')).toBeInTheDocument();

    expect(screen.getByText('SELECT COUNT(*) FROM prod.surveys')).toBeInTheDocument();

    screen.getByTestId('chat-approve').click();
    expect(respond).toHaveBeenCalledWith(true, []);
    screen.getByTestId('chat-cancel').click();
    expect(respond).toHaveBeenCalledWith(false, []);
  });

  it('shows the decided state instead of buttons once answered', () => {
    render(
      <MessageBubble
        message={message({
          inputRequest: {
            kind: 'approval',
            status: 'cancelled',
            requests: [{ tool: 'execute_sql', args: {}, description: '', sql: 'SELECT 1' }],
          },
        })}
      />
    );
    expect(screen.queryByTestId('chat-approve')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-approval-state')).toHaveTextContent('Cancelled');
  });

  it('shows a reply hint for a pending ask_user question', () => {
    render(
      <MessageBubble
        message={message({
          content: 'Which program do you mean?',
          inputRequest: {
            kind: 'question',
            status: 'pending',
            question: 'Which program do you mean?',
            requests: [],
          },
        })}
      />
    );
    expect(screen.getByTestId('chat-question-hint')).toBeInTheDocument();
  });

  it('summarizes a chart creation in plain words', () => {
    render(
      <MessageBubble
        message={message({
          inputRequest: {
            kind: 'approval',
            status: 'pending',
            requests: [
              {
                tool: 'create_chart',
                args: {
                  title: 'Surveys by district',
                  chart_type: 'bar',
                  schema_name: 'prod',
                  table_name: 'surveys',
                },
                description: '',
              },
            ],
          },
        })}
      />
    );
    expect(
      screen.getByText('Create the chart “Surveys by district” (bar) from prod.surveys?')
    ).toBeInTheDocument();
  });
});

describe('MessageBubble PII column review', () => {
  const piiMessage = (columns: PiiColumn[] | null, columnsError?: string) =>
    message({
      inputRequest: {
        kind: 'approval',
        status: 'pending',
        requests: [
          {
            tool: 'execute_sql',
            args: { sql: 'SELECT phone FROM prod.beneficiaries' },
            description: 'Waiting for your go-ahead',
            sql: 'SELECT phone FROM prod.beneficiaries',
            columns,
            columns_error: columnsError,
          },
        ],
      },
    });

  const phone = {
    schema: 'prod',
    table: 'beneficiaries',
    column: 'phone',
    has_literal: false,
  };

  it('lists the query columns bare beneath the query', () => {
    render(<MessageBubble message={piiMessage([phone])} />);
    expect(screen.getByText('Run this query on your data warehouse?')).toBeInTheDocument();
    expect(screen.getByLabelText('prod.beneficiaries.phone')).toBeInTheDocument();
    expect(
      screen.getByText(/we'll mask them before sending it to the AI provider/)
    ).toBeInTheDocument();
    // the query above already names the table — no repeated subheading
    expect(screen.queryByText('prod.beneficiaries')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-approve')).toHaveTextContent('Approve');
  });

  it('sends the ticked columns', async () => {
    const respond = jest.fn();
    render(<MessageBubble message={piiMessage([phone])} onApprovalRespond={respond} />);

    await userEvent.click(screen.getByLabelText('prod.beneficiaries.phone'));
    expect(screen.getByTestId('chat-approve')).toHaveTextContent('Approve');

    await userEvent.click(screen.getByTestId('chat-approve'));
    expect(respond).toHaveBeenCalledWith(true, ['prod.beneficiaries.phone']);
  });

  it('warns only once a column with a literal is ticked', async () => {
    render(<MessageBubble message={piiMessage([{ ...phone, has_literal: true }])} />);
    expect(screen.queryByTestId('chat-pii-literal-warning')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('prod.beneficiaries.phone'));
    expect(screen.getByTestId('chat-pii-literal-warning')).toBeInTheDocument();
  });

  it('disables approve when the column list could not be built', () => {
    render(<MessageBubble message={piiMessage(null, 'catalog unreachable')} />);
    expect(screen.getByTestId('chat-approve')).toBeDisabled();
    expect(screen.getByTestId('chat-cancel')).toBeEnabled();
    expect(screen.getByTestId('chat-pii-unavailable')).toBeInTheDocument();
  });

  it('shows a reassuring message instead of an empty checkbox list for a no-column query', () => {
    render(<MessageBubble message={piiMessage([])} />);
    expect(screen.getByText('No column values returned — nothing to mask.')).toBeInTheDocument();
    expect(screen.queryByText(/Please review your query for columns/)).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-approve')).toBeEnabled();
    expect(screen.getByTestId('chat-approve')).toHaveTextContent('Approve');
  });

  it('starts every card with nothing ticked', () => {
    render(<MessageBubble message={piiMessage([phone])} />);
    expect(screen.getByLabelText('prod.beneficiaries.phone')).not.toBeChecked();
    expect(screen.getByTestId('chat-approve')).toHaveTextContent('Approve');
  });
});

describe('MessageBubble merged approval card', () => {
  const profileRequest = (column: string, hasLiteral = false) => ({
    tool: 'lookup_column_values',
    args: { schema_name: 'staging', table_name: 'visits', column_name: column },
    description: 'Waiting for your go-ahead',
    columns: [
      { schema: 'staging', table: 'visits', column, has_literal: hasLiteral },
    ] as PiiColumn[],
  });

  const parallelProfiles = message({
    inputRequest: {
      kind: 'approval',
      status: 'pending',
      requests: [profileRequest('district'), profileRequest('gender'), profileRequest('age_group')],
    },
  });

  it('lists what each step does when a pause mixes several creations', () => {
    render(
      <MessageBubble
        message={message({
          inputRequest: {
            kind: 'approval',
            status: 'pending',
            requests: [
              {
                tool: 'create_chart',
                args: {
                  title: 'Max by district',
                  chart_type: 'bar',
                  schema_name: 'staging',
                  table_name: 'visits',
                },
                description: 'Waiting for your go-ahead',
              },
              {
                tool: 'create_dashboard',
                args: { title: 'District overview', chart_ids: [7] },
                description: 'Waiting for your go-ahead',
              },
            ],
          },
        })}
      />
    );
    expect(screen.getByText('Approve 2 steps?')).toBeInTheDocument();
    const steps = screen.getByTestId('chat-approval-steps');
    expect(steps).toHaveTextContent('Create the chart “Max by district” (bar) from staging.visits');
    expect(steps).toHaveTextContent('Create the dashboard “District overview” with 1 chart');
  });

  it('shows no step list when the headline already covers the pause', () => {
    render(<MessageBubble message={parallelProfiles} />);
    expect(screen.queryByTestId('chat-approval-steps')).not.toBeInTheDocument();
  });

  it('renders one button pair for a pause with several tool calls', () => {
    render(<MessageBubble message={parallelProfiles} />);
    expect(screen.getAllByTestId('chat-approve')).toHaveLength(1);
    expect(screen.getAllByTestId('chat-cancel')).toHaveLength(1);
  });

  it('summarizes the parallel calls as one line', () => {
    render(<MessageBubble message={parallelProfiles} />);
    expect(screen.getByText('Look up values in 3 columns?')).toBeInTheDocument();
    expect(screen.queryByText(/Waiting for your go-ahead/)).not.toBeInTheDocument();
  });

  it('lists each column once, with no repeated table subheading', () => {
    render(<MessageBubble message={parallelProfiles} />);
    expect(screen.queryByText('staging.visits')).not.toBeInTheDocument();
    expect(screen.getByLabelText('staging.visits.district')).toBeInTheDocument();
    expect(screen.getByLabelText('staging.visits.gender')).toBeInTheDocument();
    expect(screen.getByLabelText('staging.visits.age_group')).toBeInTheDocument();
  });

  it('dedupes a column two pending calls both touch', () => {
    render(
      <MessageBubble
        message={message({
          inputRequest: {
            kind: 'approval',
            status: 'pending',
            requests: [profileRequest('district'), profileRequest('district')],
          },
        })}
      />
    );
    expect(screen.getAllByLabelText('staging.visits.district')).toHaveLength(1);
  });

  it('approves every pending call with one click, sending the merged ticks', async () => {
    const respond = jest.fn();
    render(<MessageBubble message={parallelProfiles} onApprovalRespond={respond} />);

    await userEvent.click(screen.getByLabelText('staging.visits.gender'));
    await userEvent.click(screen.getByTestId('chat-approve'));

    expect(respond).toHaveBeenCalledWith(true, ['staging.visits.gender']);
  });

  it('refuses the whole card when any one call could not be reviewed', () => {
    render(
      <MessageBubble
        message={message({
          inputRequest: {
            kind: 'approval',
            status: 'pending',
            requests: [profileRequest('district'), { ...profileRequest('gender'), columns: null }],
          },
        })}
      />
    );
    expect(screen.getByTestId('chat-approve')).toBeDisabled();
    expect(screen.getByTestId('chat-pii-unavailable')).toBeInTheDocument();
  });

  it('warns when a literal from any one of the merged calls is ticked', async () => {
    render(
      <MessageBubble
        message={message({
          inputRequest: {
            kind: 'approval',
            status: 'pending',
            requests: [profileRequest('district'), profileRequest('gender', true)],
          },
        })}
      />
    );
    await userEvent.click(screen.getByLabelText('staging.visits.district'));
    expect(screen.queryByTestId('chat-pii-literal-warning')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('staging.visits.gender'));
    expect(screen.getByTestId('chat-pii-literal-warning')).toBeInTheDocument();
  });

  it('collects several pending queries under one toggle', async () => {
    render(
      <MessageBubble
        message={message({
          inputRequest: {
            kind: 'approval',
            status: 'pending',
            requests: [
              { tool: 'execute_sql', args: {}, description: '', sql: 'SELECT 1', columns: [] },
              { tool: 'execute_sql', args: {}, description: '', sql: 'SELECT 2', columns: [] },
            ],
          },
        })}
      />
    );
    expect(screen.getByText('SELECT 1')).toBeInTheDocument();
    expect(screen.getByText('SELECT 2')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('chat-approval-query-toggle'));
    expect(screen.queryByText('SELECT 1')).not.toBeInTheDocument();
  });
});
