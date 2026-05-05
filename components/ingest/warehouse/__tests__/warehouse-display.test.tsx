/**
 * Warehouse Display Tests
 *
 * Tests for WarehouseDisplay component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WarehouseDisplay } from '../warehouse-display';
import * as useWarehouseHook from '@/hooks/api/useWarehouse';
import * as usePermissionsHook from '@/hooks/api/usePermissions';
import type { Warehouse } from '@/types/warehouse';

// ============ Mocks ============

jest.mock('@/hooks/api/useWarehouse');
jest.mock('@/hooks/api/usePermissions');

jest.mock('../warehouse-form', () => ({
  WarehouseForm: () => <div data-testid="warehouse-form" />,
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: {
    deleted: jest.fn(),
    created: jest.fn(),
    updated: jest.fn(),
    generic: jest.fn(),
  },
  toastError: {
    delete: jest.fn(),
    save: jest.fn(),
    api: jest.fn(),
  },
}));

// ============ Test Data ============

const createMockWarehouse = (overrides: Partial<Warehouse> = {}): Warehouse => ({
  wtype: 'postgres',
  name: 'My Warehouse',
  destinationId: 'dest-1',
  destinationDefinitionId: 'destdef-1',
  icon: '',
  airbyteDockerRepository: 'airbyte/destination-postgres',
  tag: '0.5.0',
  connectionConfiguration: {
    host: 'db.example.com',
    port: 5432,
    database: 'mydb',
    username: 'admin',
  },
  ...overrides,
});

// ============ WarehouseDisplay Tests ============

describe('WarehouseDisplay', () => {
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useWarehouseHook.useWarehouse as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: () => true,
    });
  });

  it('shows loading spinner while fetching warehouse', () => {
    (useWarehouseHook.useWarehouse as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: null,
      mutate: mockMutate,
    });

    render(<WarehouseDisplay />);

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByTestId('warehouse-config-table')).not.toBeInTheDocument();
  });

  it('shows empty state with IP banner and set-up button; hides button without create permission', () => {
    // With create permission — button visible
    const { unmount } = render(<WarehouseDisplay />);
    expect(screen.getByTestId('ip-whitelist-banner')).toBeInTheDocument();
    expect(screen.getByText('No warehouse configured yet.')).toBeInTheDocument();
    expect(screen.getByTestId('create-warehouse-btn')).not.toBeDisabled();
    unmount();

    // Without create permission — button disabled
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (p: string) => p !== 'can_create_warehouse',
    });
    render(<WarehouseDisplay />);
    expect(screen.getByTestId('create-warehouse-btn')).toBeDisabled();
  });

  it('renders warehouse name, IP banner, and config table when warehouse exists', () => {
    (useWarehouseHook.useWarehouse as jest.Mock).mockReturnValue({
      data: createMockWarehouse(),
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    render(<WarehouseDisplay />);

    expect(screen.getByText('My Warehouse')).toBeInTheDocument();
    expect(screen.getByTestId('ip-whitelist-banner')).toBeInTheDocument();
    expect(screen.getByTestId('warehouse-config-table')).toBeInTheDocument();
    // Postgres-specific config fields from getWarehouseTableData
    expect(screen.getByText('db.example.com')).toBeInTheDocument();
    expect(screen.getByText('mydb')).toBeInTheDocument();
  });

  it('disables edit and delete buttons when user lacks those permissions', () => {
    (useWarehouseHook.useWarehouse as jest.Mock).mockReturnValue({
      data: createMockWarehouse(),
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (p: string) => p !== 'can_edit_warehouse' && p !== 'can_delete_warehouses',
    });

    render(<WarehouseDisplay />);

    expect(screen.getByTestId('edit-warehouse-btn')).toBeDisabled();
    expect(screen.getByTestId('delete-warehouse-btn')).toBeDisabled();
  });

  it('opens delete confirmation dialog and cancel closes it', async () => {
    const user = userEvent.setup();
    (useWarehouseHook.useWarehouse as jest.Mock).mockReturnValue({
      data: createMockWarehouse(),
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    render(<WarehouseDisplay />);

    await user.click(screen.getByTestId('delete-warehouse-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('cancel-delete-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-delete-btn')).not.toBeInTheDocument();
    });
  });

  it('deletes warehouse and shows success toast on confirm', async () => {
    const user = userEvent.setup();
    const mockDelete = jest.spyOn(useWarehouseHook, 'deleteWarehouse').mockResolvedValue(undefined);
    const { toastSuccess } = jest.requireMock('@/lib/toast');

    (useWarehouseHook.useWarehouse as jest.Mock).mockReturnValue({
      data: createMockWarehouse(),
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    render(<WarehouseDisplay />);

    await user.click(screen.getByTestId('delete-warehouse-btn'));
    await waitFor(() => expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument());
    await user.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(toastSuccess.deleted).toHaveBeenCalledWith('Warehouse');
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it('shows error toast and keeps dialog open when delete fails', async () => {
    const user = userEvent.setup();
    jest.spyOn(useWarehouseHook, 'deleteWarehouse').mockRejectedValue(new Error('Server error'));
    const { toastError } = jest.requireMock('@/lib/toast');

    (useWarehouseHook.useWarehouse as jest.Mock).mockReturnValue({
      data: createMockWarehouse(),
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    render(<WarehouseDisplay />);

    await user.click(screen.getByTestId('delete-warehouse-btn'));
    await waitFor(() => expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument());
    await user.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(toastError.delete).toHaveBeenCalled();
    });
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument();
  });
});
