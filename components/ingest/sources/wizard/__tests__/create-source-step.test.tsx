import { render, screen } from '@testing-library/react';
import { CreateSourceStep } from '../CreateSourceStep';

// useSourceSpec's real contract already unwraps the API's connectionSpecification
// envelope (see hooks/api/useSources.ts), so its `data` is the bare ConnectionSpecification
// that parseAirbyteSpec expects — same shape SourceForm.tsx relies on.
jest.mock('@/hooks/api/useSources', () => ({
  useSourceSpec: () => ({ data: { properties: {} }, isLoading: false }),
  GOOGLE_SHEETS_SOURCE_DEFINITION_ID: 'gs',
}));
jest.mock('@/hooks/useSourceSave', () => ({
  useSourceSave: () => ({
    save: jest.fn(),
    connectGoogle: jest.fn(),
    loading: false,
    oauthConnecting: false,
    setupLogs: [],
  }),
}));

it('shows only the Google sign-in button (no Next) for Google Sheets', () => {
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );
  expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
  expect(screen.queryByTestId('wizard-next-btn')).not.toBeInTheDocument();
});

it('shows a Next button for non-Google sources', () => {
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'kobo', name: 'KoboToolbox' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );
  expect(screen.getByTestId('wizard-next-btn')).toBeInTheDocument();
  expect(screen.getByTestId('source-helper-panel')).toBeInTheDocument();
});
