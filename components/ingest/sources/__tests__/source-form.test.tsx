/**
 * Source Form Tests
 *
 * Tests for SourceForm component (create and edit modes)
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

jest.mock('@/components/ui/combobox', () => ({
  Combobox: ({
    items,
    onValueChange,
    value,
    disabled,
    placeholder,
  }: {
    items: Array<{ value: string; label: string }>;
    onValueChange?: (value: string) => void;
    value?: string;
    disabled?: boolean;
    placeholder?: string;
  }) => (
    <div data-testid="source-type-combobox">
      <input placeholder={placeholder} readOnly value={value || ''} />
      {!disabled &&
        items.map((item) => (
          <button
            key={item.value}
            data-testid={`combobox-option-${item.value}`}
            onClick={() => onValueChange?.(item.value)}
          >
            {item.label}
          </button>
        ))}
    </div>
  ),
  highlightText: (text: string) => text,
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { deleted: jest.fn(), created: jest.fn(), updated: jest.fn(), generic: jest.fn() },
  toastError: { delete: jest.fn(), save: jest.fn(), api: jest.fn() },
}));

// ============ SourceForm Tests ============

describe('SourceForm', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onSuccess: mockOnSuccess,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/airbyte/source_definitions')
        return Promise.resolve([createMockDefinition()]);
      return Promise.resolve(undefined);
    });
  });

  it('does not render form when open is false', () => {
    render(<SourceForm {...defaultProps} open={false} />, { wrapper: TestWrapper });
    expect(screen.queryByTestId('source-form')).not.toBeInTheDocument();
  });

  it('renders create mode with correct title and disabled save button', async () => {
    render(<SourceForm {...defaultProps} />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Add Source')).toBeInTheDocument();
      expect(screen.getByTestId('source-save-btn')).toBeDisabled();
    });
  });

  it('renders edit mode with correct title, pre-filled name, and disabled source type selector', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/airbyte/source_definitions')
        return Promise.resolve([createMockDefinition()]);
      if (url === '/api/airbyte/sources/src-1') return Promise.resolve(createMockSource());
      return Promise.resolve(undefined);
    });

    render(<SourceForm {...defaultProps} sourceId="src-1" />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Edit Source')).toBeInTheDocument();
      expect(screen.getByTestId('source-name-input')).toHaveValue('My Postgres Source');
    });

    // Source type combobox is disabled in edit mode — no option buttons rendered
    expect(screen.queryByTestId('combobox-option-def-1')).not.toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<SourceForm {...defaultProps} />, { wrapper: TestWrapper });

    await user.click(screen.getByTestId('source-cancel-btn'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows spec loading indicator after selecting a source type', async () => {
    const user = userEvent.setup();
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/airbyte/source_definitions')
        return Promise.resolve([createMockDefinition()]);
      if (url.includes('/specifications')) return new Promise(() => {}); // never resolves → isLoading: true
      return Promise.resolve(undefined);
    });

    render(<SourceForm {...defaultProps} />, { wrapper: TestWrapper });
    await waitFor(() => expect(screen.getByTestId('combobox-option-def-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('combobox-option-def-1'));

    await waitFor(() => {
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
    });
  });

  it('shows ConnectorConfigForm once spec has loaded', async () => {
    const user = userEvent.setup();
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/airbyte/source_definitions')
        return Promise.resolve([createMockDefinition()]);
      if (url.includes('/specifications'))
        return Promise.resolve({ connectionSpecification: { type: 'object', properties: {} } });
      return Promise.resolve(undefined);
    });

    render(<SourceForm {...defaultProps} />, { wrapper: TestWrapper });
    await waitFor(() => expect(screen.getByTestId('combobox-option-def-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('combobox-option-def-1'));

    await waitFor(() => {
      expect(screen.getByTestId('connector-config-form')).toBeInTheDocument();
    });
  });

  it('enables save button when name, source type, and spec are all present', async () => {
    const user = userEvent.setup();
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/airbyte/source_definitions')
        return Promise.resolve([createMockDefinition()]);
      if (url.includes('/specifications'))
        return Promise.resolve({ connectionSpecification: { type: 'object', properties: {} } });
      return Promise.resolve(undefined);
    });

    render(<SourceForm {...defaultProps} />, { wrapper: TestWrapper });
    await waitFor(() => expect(screen.getByTestId('combobox-option-def-1')).toBeInTheDocument());

    await user.type(screen.getByTestId('source-name-input'), 'My New Source');
    await user.click(screen.getByTestId('combobox-option-def-1'));

    await waitFor(() => {
      expect(screen.getByTestId('source-save-btn')).not.toBeDisabled();
    });
  });
});
