import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionHelpPanel } from '../connection-help-panel';
import { CONNECTION_HELP, getConnectionHelp } from '../constants';

describe('ConnectionHelpPanel', () => {
  it('renders every concept as a collapsed accordion heading', () => {
    render(<ConnectionHelpPanel activeConcept={null} onConceptChange={jest.fn()} />);

    CONNECTION_HELP.forEach((c) => {
      expect(screen.getByTestId(`concept-card-${c.id}`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: c.title })).toHaveAttribute(
        'aria-expanded',
        'false'
      );
      expect(screen.queryByText(c.body)).not.toBeInTheDocument();
    });
  });

  it('opens and highlights the active concept', () => {
    render(<ConnectionHelpPanel activeConcept="dest-mode" onConceptChange={jest.fn()} />);

    expect(screen.getByTestId('concept-card-dest-mode')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('concept-card-stream')).toHaveAttribute('data-active', 'false');
    expect(screen.getByRole('button', { name: 'Destination' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText(CONNECTION_HELP.find((c) => c.id === 'dest-mode')!.body)).toBeVisible();
  });

  it('reports accordion changes so the parent can open or collapse a section', async () => {
    const user = userEvent.setup();
    const onConceptChange = jest.fn();
    const { rerender } = render(
      <ConnectionHelpPanel activeConcept={null} onConceptChange={onConceptChange} />
    );

    await user.click(screen.getByRole('button', { name: 'Columns' }));
    expect(onConceptChange).toHaveBeenCalledWith('columns');

    rerender(<ConnectionHelpPanel activeConcept="columns" onConceptChange={onConceptChange} />);
    await user.click(screen.getByRole('button', { name: 'Columns' }));
    expect(onConceptChange).toHaveBeenLastCalledWith(null);
  });

  it('uses table labels and tells users where advanced settings are located', () => {
    const concepts = getConnectionHelp();
    const destination = concepts.find((concept) => concept.id === 'dest-mode');
    const columns = concepts.find((concept) => concept.id === 'columns');
    const schema = concepts.find((concept) => concept.id === 'schema');

    expect(destination).toMatchObject({ title: 'Destination' });
    expect(destination?.body).toContain('Under Advanced per-table settings');
    expect(columns?.body).toContain('Turn on Advanced per-table settings');
    expect(columns?.body).toContain('chevron at the right of a table row');
    expect(schema?.body).toContain('Under Advanced options');
  });

  it('explains that Google Sheets columns and casts work without advanced settings', () => {
    const columns = getConnectionHelp({ supportsColumnCasting: true }).find(
      (concept) => concept.id === 'columns'
    );

    expect(columns?.body).toContain('Cast to');
    expect(columns?.body).toContain('without turning on Advanced per-table settings');
  });
});
