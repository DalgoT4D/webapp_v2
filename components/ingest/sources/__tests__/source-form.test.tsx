/**
 * Source Form Tests
 *
 * SourceForm only edits an existing source — creation lives in the add-source
 * wizard (see wizard/__tests__/create-source-step.test.tsx).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceForm } from '../SourceForm';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';
import { createMockSource, createMockDefinition } from './sources-mock-data';

// ============ Mocks ============

jest.mock('@/hooks/useBackendWebSocket', () => ({
  useBackendWebSocket: () => ({
    sendOrQueue: jest.fn(),
    lastMessage: null,
  }),
}));

jest.mock('@/components/connectors/ConnectorConfigForm', () => ({
  ConnectorConfigForm: () => <div data-testid="connector-config-form" />,
}));

jest.mock('@/components/connectors/spec-parser', () => ({
  parseAirbyteSpec: jest.fn(() => ({ fields: [] })),
}));

jest.mock('@/components/connectors/utils', () => ({
  cleanFormValues: jest.fn((values: unknown) => values),
  extractSpecDefaults: jest.fn(() => ({})),
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { deleted: jest.fn(), created: jest.fn(), updated: jest.fn(), generic: jest.fn() },
  toastError: { delete: jest.fn(), save: jest.fn(), api: jest.fn() },
}));

// ============ Helpers ============

const SPEC_RESPONSE = { connectionSpecification: { type: 'object', properties: {} } };

/** Wire the three GETs the dialog makes: definitions, the source, and its spec. */
function mockApis({
  source = createMockSource(),
  definitions = [createMockDefinition()],
  spec = SPEC_RESPONSE as unknown,
}: {
  source?: ReturnType<typeof createMockSource>;
  definitions?: ReturnType<typeof createMockDefinition>[];
  spec?: unknown;
} = {}) {
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/api/airbyte/source_definitions') return Promise.resolve(definitions);
    if (url === `/api/airbyte/sources/${source.sourceId}`) return Promise.resolve(source);
    if (url.includes('/specifications')) return Promise.resolve(spec);
    return Promise.resolve(undefined);
  });
}

// ============ SourceForm Tests ============

describe('SourceForm', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onSuccess: mockOnSuccess,
    sourceId: 'src-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockApis();
  });

  it('does not render form when open is false', () => {
    render(<SourceForm {...defaultProps} open={false} />, { wrapper: TestWrapper });
    expect(screen.queryByTestId('source-form')).not.toBeInTheDocument();
  });

  it('renders the edit dialog with the pre-filled name and a read-only source type', async () => {
    render(<SourceForm {...defaultProps} />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Edit Source')).toBeInTheDocument();
      expect(screen.getByTestId('source-name-input')).toHaveValue('My Postgres Source');
    });

    // The type is fixed for an existing source: shown as text, never as a picker.
    expect(screen.getByTestId('source-type-display')).toHaveTextContent('Postgres');
    expect(screen.queryByTestId('source-type-combobox')).not.toBeInTheDocument();
  });

  it('holds a single loader until the source and its spec are ready', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/airbyte/source_definitions')
        return Promise.resolve([createMockDefinition()]);
      if (url.includes('/specifications')) return new Promise(() => {}); // never resolves
      return new Promise(() => {});
    });

    render(<SourceForm {...defaultProps} />, { wrapper: TestWrapper });

    expect(await screen.findByTestId('source-form-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('source-form')).not.toBeInTheDocument();
  });

  // The save button stays clickable on an incomplete form: pressing it is what
  // reveals the inline required-field errors, rather than a silently disabled button.
  it('keeps the save button enabled and surfaces an inline error for an empty name', async () => {
    const user = userEvent.setup();
    render(<SourceForm {...defaultProps} />, { wrapper: TestWrapper });

    const nameInput = await screen.findByTestId('source-name-input');
    await user.clear(nameInput);

    const saveBtn = screen.getByTestId('source-save-btn');
    expect(saveBtn).toBeEnabled();
    await user.click(saveBtn);

    expect(await screen.findByTestId('source-name-error')).toHaveTextContent(
      'Source name is required'
    );
  });

  it('clears the name error as soon as the user types again', async () => {
    const user = userEvent.setup();
    render(<SourceForm {...defaultProps} />, { wrapper: TestWrapper });

    const nameInput = await screen.findByTestId('source-name-input');
    await user.clear(nameInput);
    await user.click(screen.getByTestId('source-save-btn'));
    expect(await screen.findByTestId('source-name-error')).toBeInTheDocument();

    await user.type(nameInput, 'Renamed source');
    expect(screen.queryByTestId('source-name-error')).not.toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<SourceForm {...defaultProps} />, { wrapper: TestWrapper });

    await user.click(await screen.findByTestId('source-cancel-btn'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders the generic spec-driven form for a source with no custom form', async () => {
    render(<SourceForm {...defaultProps} />, { wrapper: TestWrapper });

    expect(await screen.findByTestId('connector-config-form')).toBeInTheDocument();
    expect(screen.queryByTestId('kobo-toolbox-form')).not.toBeInTheDocument();
  });

  it('renders the KoboToolbox custom form instead of the generic form', async () => {
    mockApis({
      source: createMockSource({ sourceDefinitionId: 'kobo-def', sourceName: 'KoboToolbox' }),
      definitions: [createMockDefinition({ sourceDefinitionId: 'kobo-def', name: 'KoboToolbox' })],
    });

    render(<SourceForm {...defaultProps} />, { wrapper: TestWrapper });

    expect(await screen.findByTestId('kobo-toolbox-form')).toBeInTheDocument();
    // The generic form must NOT render for a custom source.
    expect(screen.queryByTestId('connector-config-form')).not.toBeInTheDocument();
  });
});
