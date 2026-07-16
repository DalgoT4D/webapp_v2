import { render, screen, fireEvent } from '@testing-library/react';
import { SelectSourceStep } from '../SelectSourceStep';

jest.mock('@/hooks/api/useSources', () => ({
  useSourceDefinitions: () => ({
    data: [
      { sourceDefinitionId: 'gs', name: 'Google Sheets' },
      { sourceDefinitionId: 'kobo', name: 'KoboToolbox' },
      { sourceDefinitionId: 'cc', name: 'CommCare' },
      { sourceDefinitionId: 'scto', name: 'SurveyCTO' },
      { sourceDefinitionId: 'pg', name: 'Postgres' },
    ],
  }),
}));

it('selects a card, then fires onSelect with the definition on Next', () => {
  const onSelect = jest.fn();
  render(<SelectSourceStep onSelect={onSelect} onClose={jest.fn()} />);
  const card = screen.getByTestId('source-card-Google Sheets');
  expect(card).toBeInTheDocument();
  // Only the two custom-UI sources appear as cards; everything else is search-only.
  expect(screen.getByTestId('source-card-KoboToolbox')).toBeInTheDocument();
  expect(screen.queryByTestId('source-card-CommCare')).not.toBeInTheDocument();
  expect(screen.queryByTestId('source-card-Postgres')).not.toBeInTheDocument();

  // Next is disabled until a source is picked; clicking a card only selects it.
  expect(screen.getByTestId('wizard-select-next-btn')).toBeDisabled();
  fireEvent.click(card);
  expect(onSelect).not.toHaveBeenCalled();

  fireEvent.click(screen.getByTestId('wizard-select-next-btn'));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ sourceDefinitionId: 'gs' }));
});

it('filters the full definition list by the search box', () => {
  render(<SelectSourceStep onSelect={jest.fn()} onClose={jest.fn()} />);
  fireEvent.change(screen.getByTestId('source-search-input'), { target: { value: 'postgres' } });
  expect(screen.getByText('Postgres')).toBeInTheDocument();
});
