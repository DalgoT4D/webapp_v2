import { render, screen } from '@testing-library/react';
import { ConnectionHelpPanel } from '../connection-help-panel';
import { CONNECTION_HELP } from '../constants';

describe('ConnectionHelpPanel', () => {
  it('renders a card for every concept', () => {
    render(<ConnectionHelpPanel activeConcept={null} />);
    CONNECTION_HELP.forEach((c) => {
      expect(screen.getByTestId(`concept-card-${c.id}`)).toBeInTheDocument();
      expect(screen.getByText(c.title)).toBeInTheDocument();
    });
  });

  it('marks the active concept card', () => {
    render(<ConnectionHelpPanel activeConcept="dest-mode" />);
    expect(screen.getByTestId('concept-card-dest-mode')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('concept-card-stream')).toHaveAttribute('data-active', 'false');
  });
});
