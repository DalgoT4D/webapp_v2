import { render, screen, fireEvent } from '@testing-library/react';
import { ToolProgress } from '../ToolProgress';
import type { ToolActivity } from '@/types/chat-with-data';

const runningTool: ToolActivity = {
  tool: 'list_tables',
  label: 'Looking at your tables…',
  status: 'running',
};

const sqlTool: ToolActivity = {
  tool: 'execute_sql',
  label: 'Running query…',
  sql: 'SELECT COUNT(*) FROM prod.surveys',
  status: 'success',
};

describe('ToolProgress', () => {
  it('shows a plain-language chip per tool activity', () => {
    render(<ToolProgress tools={[runningTool, sqlTool]} />);
    expect(screen.getByText('Looking at your tables…')).toBeInTheDocument();
    expect(screen.getByText('Running query…')).toBeInTheDocument();
  });

  it('reveals the SQL behind a collapsible toggle', () => {
    render(<ToolProgress tools={[sqlTool]} />);
    expect(screen.queryByText(sqlTool.sql as string)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('view-sql-toggle-0'));
    expect(screen.getByText(sqlTool.sql as string)).toBeInTheDocument();
  });

  it('renders nothing when there are no tool activities', () => {
    const { container } = render(<ToolProgress tools={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
