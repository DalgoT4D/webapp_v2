import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { RecipientCombobox } from '../RecipientCombobox';
import type { RecipientIn } from '@/types/alerts';

function Wrapper({ initial }: { initial?: RecipientIn[] }) {
  const [v, setV] = useState<RecipientIn[]>(initial ?? []);
  return <RecipientCombobox value={v} onChange={setV} />;
}

describe('RecipientCombobox (email-only)', () => {
  it('adds a chip when a valid email is typed and Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const input = screen.getByTestId('recipient-add-input');
    await user.type(input, 'priya@example.com{Enter}');

    expect(screen.getByTestId('recipient-chip-external')).toBeInTheDocument();
    expect(screen.getByText('priya@example.com')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('commits the email on blur', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const input = screen.getByTestId('recipient-add-input');
    await user.type(input, 'blur@example.com');
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByText('blur@example.com')).toBeInTheDocument();
    });
  });

  it('shows a validation error when the email is malformed', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const input = screen.getByTestId('recipient-add-input');
    await user.type(input, 'not-an-email{Enter}');

    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(screen.queryByTestId('recipient-chip-external')).not.toBeInTheDocument();
  });

  it('rejects duplicate emails with an inline error', async () => {
    const user = userEvent.setup();
    render(<Wrapper initial={[{ type: 'external', email: 'dup@example.com' }]} />);

    const input = screen.getByTestId('recipient-add-input');
    await user.type(input, 'dup@example.com{Enter}');

    expect(screen.getByText(/already added/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('recipient-chip-external')).toHaveLength(1);
  });

  it('removes a chip when the X button is clicked', async () => {
    render(<Wrapper initial={[{ type: 'external', email: 'bye@example.com' }]} />);

    expect(screen.getByText('bye@example.com')).toBeInTheDocument();
    const removeBtn = screen.getByLabelText(/Remove bye@example.com/i);
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText('bye@example.com')).not.toBeInTheDocument();
    });
  });

  it('removes the last chip when Backspace is pressed with an empty input', async () => {
    const user = userEvent.setup();
    render(<Wrapper initial={[{ type: 'external', email: 'last@example.com' }]} />);

    const input = screen.getByTestId('recipient-add-input');
    input.focus();
    await user.keyboard('{Backspace}');

    await waitFor(() => {
      expect(screen.queryByText('last@example.com')).not.toBeInTheDocument();
    });
  });
});
