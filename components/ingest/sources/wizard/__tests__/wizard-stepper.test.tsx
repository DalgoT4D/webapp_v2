import { render, screen } from '@testing-library/react';
import { WizardStepper } from '../WizardStepper';

it('renders all three step labels and marks the current one', () => {
  render(<WizardStepper current="configure" />);
  expect(screen.getByText('Select source')).toBeInTheDocument();
  expect(screen.getByText('Create source')).toBeInTheDocument();
  expect(screen.getByText('Connection')).toBeInTheDocument();
  expect(screen.getByTestId('wizard-step-configure')).toHaveAttribute('data-active', 'true');
  expect(screen.getByTestId('wizard-step-select')).toHaveAttribute('data-complete', 'true');
});
