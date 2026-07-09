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

it('shows the four matched top-source cards and fires onSelect with the definition', () => {
  const onSelect = jest.fn();
  render(<SelectSourceStep onSelect={onSelect} />);
  const card = screen.getByTestId('source-card-Google Sheets');
  expect(card).toBeInTheDocument();
  expect(screen.getByTestId('source-card-SurveyCTO')).toBeInTheDocument();
  fireEvent.click(card);
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ sourceDefinitionId: 'gs' }));
});

it('filters the full definition list by the search box', () => {
  render(<SelectSourceStep onSelect={jest.fn()} />);
  fireEvent.change(screen.getByTestId('source-search-input'), { target: { value: 'postgres' } });
  expect(screen.getByText('Postgres')).toBeInTheDocument();
});
