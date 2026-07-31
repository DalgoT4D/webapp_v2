import { render, screen, fireEvent } from '@testing-library/react';
import { AddSourceWizard } from '../AddSourceWizard';

jest.mock('../SelectSourceStep', () => ({
  SelectSourceStep: ({ onSelect }: any) => (
    <button
      data-testid="pick"
      onClick={() => onSelect({ sourceDefinitionId: 'kobo', name: 'KoboToolbox' })}
    >
      pick
    </button>
  ),
}));
jest.mock('../CreateSourceStep', () => ({
  CreateSourceStep: ({ onCreated }: any) => (
    <button data-testid="create" onClick={() => onCreated('src-9')}>
      create
    </button>
  ),
}));
jest.mock('@/components/connections/connection-form-body', () => ({
  ConnectionFormBody: ({ presetSourceId }: any) => (
    <div data-testid="conn-body">source:{presetSourceId}</div>
  ),
}));
jest.mock('@/components/ingest/warehouse/warehouse-form-body', () => ({
  WarehouseFormBody: ({ onSuccess }: any) => (
    <button data-testid="wh-save" onClick={onSuccess}>
      save warehouse
    </button>
  ),
}));

it('advances select → configure → connection and passes the created source id', () => {
  render(<AddSourceWizard open onClose={jest.fn()} onComplete={jest.fn()} />);
  expect(screen.getByTestId('pick')).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('pick'));
  expect(screen.getByTestId('create')).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('create'));
  expect(screen.getByTestId('conn-body')).toHaveTextContent('source:src-9');
});

it('with needsWarehouse: starts a 4-step flow on the warehouse step, then advances', () => {
  render(<AddSourceWizard open needsWarehouse onClose={jest.fn()} onComplete={jest.fn()} />);

  // Step 1 of 4 is the warehouse form.
  expect(screen.getByTestId('wh-save')).toBeInTheDocument();
  expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();

  // Saving the warehouse advances to the source picker (stays open).
  fireEvent.click(screen.getByTestId('wh-save'));
  expect(screen.getByTestId('pick')).toBeInTheDocument();
  expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
});

it('refreshes the list (onComplete) when dismissed after the source is created', () => {
  const onClose = jest.fn();
  const onComplete = jest.fn();
  render(<AddSourceWizard open onClose={onClose} onComplete={onComplete} />);

  // Advance to the connection step so a source has been created.
  fireEvent.click(screen.getByTestId('pick'));
  fireEvent.click(screen.getByTestId('create'));
  expect(screen.getByTestId('conn-body')).toBeInTheDocument();

  // Dismiss via the dialog's X (Radix onOpenChange→false), not the footer.
  fireEvent.click(screen.getByRole('button', { name: /close/i }));

  // Source exists server-side now → parent must refresh, so onComplete fires
  // (which closes + refreshes). A bare onClose here would leave the list stale.
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
});

it('just closes (onClose) when dismissed before any source is created', () => {
  const onClose = jest.fn();
  const onComplete = jest.fn();
  render(<AddSourceWizard open onClose={onClose} onComplete={onComplete} />);

  // Still on the select step — no source created yet.
  expect(screen.getByTestId('pick')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /close/i }));

  // Nothing was created, so there is nothing to refresh — just close.
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onComplete).not.toHaveBeenCalled();
});
