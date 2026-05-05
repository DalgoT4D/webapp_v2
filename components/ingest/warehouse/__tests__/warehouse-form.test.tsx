/**
 * Warehouse Form Tests
 *
 * Tests for WarehouseForm component (create and edit modes)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WarehouseForm } from '../warehouse-form';
import * as useWarehouseHook from '@/hooks/api/useWarehouse';
import type { Warehouse } from '@/types/warehouse';

// ============ Mocks ============

jest.mock('@/hooks/api/useWarehouse');

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
    <div data-testid="warehouse-type-combobox">
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

// ============ Test Data ============

const mockDefinition = {
  destinationDefinitionId: 'destdef-1',
  name: 'Postgres',
  icon: '',
  dockerRepository: 'airbyte/destination-postgres',
  dockerImageTag: '0.5.0',
};

const createMockWarehouse = (overrides: Partial<Warehouse> = {}): Warehouse => ({
  wtype: 'postgres',
  name: 'My Warehouse',
  destinationId: 'dest-1',
  destinationDefinitionId: 'destdef-1',
  icon: '',
  airbyteDockerRepository: 'airbyte/destination-postgres',
  tag: '0.5.0',
  connectionConfiguration: { host: 'db.example.com' },
  ...overrides,
});

// ============ WarehouseForm Tests ============

describe('WarehouseForm', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSuccess = jest.fn();

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    onSuccess: mockOnSuccess,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useWarehouseHook.useDestinationDefinitions as jest.Mock).mockReturnValue({
      data: [mockDefinition],
      isLoading: false,
      isError: null,
    });
    (useWarehouseHook.useDestinationSpec as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: null,
    });
    (useWarehouseHook.useDestinationEditSpec as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: null,
    });
  });

  it('renders create mode with correct title and disabled save button', () => {
    render(<WarehouseForm {...defaultProps} />);

    expect(screen.getByText('Set Up Warehouse')).toBeInTheDocument();
    expect(screen.getByTestId('save-warehouse-btn')).toBeDisabled();
  });

  it('renders edit mode with correct title and pre-filled name once spec loads', async () => {
    (useWarehouseHook.useDestinationEditSpec as jest.Mock).mockReturnValue({
      data: { type: 'object', properties: {} },
      isLoading: false,
      isError: null,
    });

    render(<WarehouseForm {...defaultProps} warehouse={createMockWarehouse()} isEditing />);

    await waitFor(() => {
      expect(screen.getByText('Edit Warehouse')).toBeInTheDocument();
      expect(screen.getByTestId('warehouse-name-input')).toHaveValue('My Warehouse');
    });

    // Type combobox is disabled in edit mode
    expect(screen.queryByTestId('combobox-option-destdef-1')).not.toBeInTheDocument();
  });

  it('shows loading state in edit mode until spec arrives', () => {
    // spec not yet loaded — showForm = false
    render(<WarehouseForm {...defaultProps} warehouse={createMockWarehouse()} isEditing />);

    expect(screen.queryByTestId('warehouse-form')).not.toBeInTheDocument();
    expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<WarehouseForm {...defaultProps} />);

    await user.click(screen.getByTestId('warehouse-cancel-btn'));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows name validation error when submitting without a name', async () => {
    const user = userEvent.setup();
    // Give it a spec so save button is enabled
    (useWarehouseHook.useDestinationSpec as jest.Mock).mockReturnValue({
      data: { type: 'object', properties: {} },
      isLoading: false,
      isError: null,
    });

    render(<WarehouseForm {...defaultProps} />);
    await user.click(screen.getByTestId('combobox-option-destdef-1'));

    await waitFor(() => expect(screen.getByTestId('save-warehouse-btn')).not.toBeDisabled());
    await user.click(screen.getByTestId('save-warehouse-btn'));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('shows ConnectorConfigForm and enables save once spec has loaded', async () => {
    const user = userEvent.setup();
    (useWarehouseHook.useDestinationSpec as jest.Mock).mockReturnValue({
      data: { type: 'object', properties: {} },
      isLoading: false,
      isError: null,
    });

    render(<WarehouseForm {...defaultProps} />);
    await user.click(screen.getByTestId('combobox-option-destdef-1'));

    await waitFor(() => {
      expect(screen.getByTestId('connector-config-form')).toBeInTheDocument();
      expect(screen.getByTestId('save-warehouse-btn')).not.toBeDisabled();
    });
  });
});
