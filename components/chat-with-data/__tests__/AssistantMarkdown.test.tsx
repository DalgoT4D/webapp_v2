import { render, screen } from '@testing-library/react';
import { AssistantMarkdown } from '../AssistantMarkdown';

describe('AssistantMarkdown', () => {
  it('renders **bold** as strong text inside a paragraph', () => {
    render(<AssistantMarkdown content="You ran **1,284 surveys** in June." />);
    const strong = screen.getByText('1,284 surveys');
    expect(strong.tagName).toBe('STRONG');
    expect(screen.getByText(/in June/)).toBeInTheDocument();
  });

  it('renders consecutive "- " lines as a bullet list', () => {
    render(<AssistantMarkdown content={'Breakdown:\n\n- Pune — **700**\n- Nagpur — **400**'} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Pune — 700');
    expect(items[0].closest('ul')).toBeInTheDocument();
  });

  it('renders "### " lines as topic headings', () => {
    render(<AssistantMarkdown content={'### Enrollment trend\n\nNumbers are up.'} />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('Enrollment trend');
    expect(screen.getByText('Numbers are up.')).toBeInTheDocument();
  });

  it('renders "> " lines as a highlighted key-insight callout', () => {
    render(
      <AssistantMarkdown
        content={'Enrollment fell in 3 districts.\n\n> **Nashik** dropped 40% — worth a look.'}
      />
    );
    const callout = screen.getByTestId('chat-answer-callout');
    expect(callout).toHaveTextContent('Nashik');
    expect(callout).toHaveTextContent('worth a look');
  });

  it('renders `backticked` names as inline code instead of literal backticks', () => {
    render(<AssistantMarkdown content="Source: `prod.surveys`, grouped by `country`." />);
    const code = screen.getByText('prod.surveys');
    expect(code.tagName).toBe('CODE');
    expect(screen.queryByText(/`/)).not.toBeInTheDocument();
  });

  it('renders anything outside the subset as literal text — no links or HTML', () => {
    render(
      <AssistantMarkdown
        content={'See [docs](https://evil.example) or <img src="x" onerror="alert(1)" />'}
      />
    );
    // the link syntax and HTML stay visible as text; nothing becomes an element
    expect(screen.getByText(/\[docs\]\(https:\/\/evil\.example\)/)).toBeInTheDocument();
    expect(document.querySelector('a')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });
});
