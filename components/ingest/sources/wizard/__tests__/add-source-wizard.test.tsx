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

it('advances select → configure → connection and passes the created source id', () => {
  render(<AddSourceWizard open onClose={jest.fn()} onComplete={jest.fn()} />);
  expect(screen.getByTestId('wizard-step-select')).toHaveAttribute('data-active', 'true');
  fireEvent.click(screen.getByTestId('pick'));
  expect(screen.getByTestId('wizard-step-configure')).toHaveAttribute('data-active', 'true');
  fireEvent.click(screen.getByTestId('create'));
  expect(screen.getByTestId('wizard-step-connection')).toHaveAttribute('data-active', 'true');
  expect(screen.getByTestId('conn-body')).toHaveTextContent('source:src-9');
});
