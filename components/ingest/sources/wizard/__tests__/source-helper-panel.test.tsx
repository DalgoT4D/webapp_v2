import { render, screen } from '@testing-library/react';
import { SourceHelperPanel } from '../SourceHelperPanel';

it('renders the source-specific title and numbered steps', () => {
  render(<SourceHelperPanel sourceName="Google Sheets" />);
  expect(screen.getByText('How to connect Google Sheets')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
});
