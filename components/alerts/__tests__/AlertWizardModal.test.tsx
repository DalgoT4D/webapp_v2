import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { AlertWizardModal } from '../AlertWizardModal';
import { apiGet, apiPost } from '@/lib/api';

const mockApiGet = apiGet as jest.Mock;
const mockApiPost = apiPost as jest.Mock;

jest.mock('@/lib/toast', () => ({
  toastSuccess: { created: jest.fn(), updated: jest.fn() },
  toastError: { create: jest.fn(), update: jest.fn() },
}));

// The DatasetSelector pulls heavy warehouse hooks we don't want in this test.
// Replace it with a thin stub that lets the test set schema_name + table_name.
jest.mock('@/components/charts/DatasetSelector', () => ({
  DatasetSelector: ({ onDatasetChange }: { onDatasetChange: (s: string, t: string) => void }) => (
    <button
      type="button"
      data-testid="stub-dataset-selector"
      onClick={() => onDatasetChange('analytics', 'events')}
    >
      pick dataset
    </button>
  ),
}));

// Mock useWarehouse so the Standalone column combobox does not crash.
jest.mock('@/hooks/api/useWarehouse', () => ({
  useTableColumns: () => ({
    data: [
      { name: 'count', data_type: 'integer' },
      { name: 'amount', data_type: 'numeric' },
    ],
  }),
}));

function renderModal() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <AlertWizardModal open onOpenChange={() => {}} initial={{ alertType: 'standalone' }} />
    </SWRConfig>
  );
}

describe('AlertWizardModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockResolvedValue([]);
    mockApiPost.mockResolvedValue({
      id: 99,
      name: 'X',
      alert_type: 'standalone',
      condition: { operator: 'lt', value: 50 },
    });
  });

  it('opens on step 1 with type heading', () => {
    renderModal();
    expect(screen.getByTestId('wizard-step-circle-1')).toHaveAttribute('data-active', 'true');
  });

  it('blocks Next until step 1 is valid (name + source + condition)', async () => {
    const user = userEvent.setup();
    renderModal();

    // Click Next with nothing filled — should stay on step 1
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByTestId('wizard-step-circle-1')).toHaveAttribute('data-active', 'true');
    expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
  });

  it('advances to step 2 once all step-1 fields are valid', async () => {
    const user = userEvent.setup();
    renderModal();

    // Name
    await user.type(screen.getByPlaceholderText(/Daily new signups/i), 'Anomaly check');

    // Dataset (via the stub)
    await user.click(screen.getByTestId('stub-dataset-selector'));

    // Aggregation
    const aggTriggers = screen.getAllByRole('combobox');
    // The first combobox is Function (aggregation), then Column, etc.
    // Use the label text to find a specific row instead — pick from the Select
    // labelled "Function".
    await user.click(aggTriggers[0]);
    await user.click(await screen.findByText('Count'));

    // Condition value
    const valueInput = screen.getByPlaceholderText(/e\.g\. 50/i);
    await user.type(valueInput, '10');

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-circle-2')).toHaveAttribute('data-active', 'true');
    });
  });

  it('Back from step 2 returns to step 1 preserving the values', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText(/Daily new signups/i), 'My alert');
    await user.click(screen.getByTestId('stub-dataset-selector'));
    const aggTriggers = screen.getAllByRole('combobox');
    await user.click(aggTriggers[0]);
    await user.click(await screen.findByText('Count'));
    await user.type(screen.getByPlaceholderText(/e\.g\. 50/i), '5');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-circle-2')).toHaveAttribute('data-active', 'true');
    });

    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByTestId('wizard-step-circle-1')).toHaveAttribute('data-active', 'true');
    expect(screen.getByDisplayValue('My alert')).toBeInTheDocument();
  });
});
