import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { RecipientPicker } from '../RecipientPicker';
import type { RecipientIn } from '@/types/alerts';
import type { PersonRow } from '@/types/user-management';
import type { GroupListRow } from '@/types/user-groups';

jest.mock('@/hooks/api/useAccess', () => ({
  useActiveMembers: jest.fn(),
  useUserGroups: jest.fn(),
}));

import { useActiveMembers, useUserGroups } from '@/hooks/api/useAccess';

const MEMBERS: PersonRow[] = [
  {
    orguser_id: 1,
    email: 'alice@org.com',
    role_slug: 'analyst',
    role_name: 'Analyst',
    status: 'active',
    created_by_email: null,
    invitation_id: null,
    created_at: null,
  },
  {
    orguser_id: 2,
    email: 'bob@org.com',
    role_slug: 'member',
    role_name: 'Member',
    status: 'active',
    created_by_email: null,
    invitation_id: null,
    created_at: null,
  },
];

const GROUPS: GroupListRow[] = [
  {
    id: 10,
    name: 'Finance Team',
    member_count: 3,
    created_by_email: null,
    created_at: '2024-01-01',
  },
  { id: 11, name: 'Data Team', member_count: 5, created_by_email: null, created_at: '2024-01-01' },
];

function setup() {
  (useActiveMembers as jest.Mock).mockReturnValue({
    people: MEMBERS,
    isLoading: false,
    error: null,
    mutate: jest.fn(),
  });
  (useUserGroups as jest.Mock).mockReturnValue({
    groups: GROUPS,
    isLoading: false,
    error: null,
    mutate: jest.fn(),
  });
}

function Wrapper({ initial }: { initial?: RecipientIn[] }) {
  const [v, setV] = useState<RecipientIn[]>(initial ?? []);
  return <RecipientPicker value={v} onChange={setV} />;
}

describe('RecipientPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setup();
  });

  it('adds an external email chip on Enter', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const input = screen.getByTestId('recipient-add-input');
    await user.type(input, 'ext@example.com{Enter}');

    expect(screen.getByTestId('recipient-chip-external')).toBeInTheDocument();
    expect(screen.getByText('ext@example.com')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('shows validation error for malformed email on Enter', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const input = screen.getByTestId('recipient-add-input');
    await user.type(input, 'not-an-email{Enter}');

    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(screen.queryByTestId('recipient-chip-external')).not.toBeInTheDocument();
  });

  it('shows member and group suggestions on focus', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const input = screen.getByTestId('recipient-add-input');
    await user.click(input);

    expect(screen.getByText('alice@org.com')).toBeInTheDocument();
    expect(screen.getByText('bob@org.com')).toBeInTheDocument();
    expect(screen.getByText('Finance Team')).toBeInTheDocument();
    expect(screen.getByText('Data Team')).toBeInTheDocument();
  });

  it('filters members by draft query', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const input = screen.getByTestId('recipient-add-input');
    await user.type(input, 'alice');

    expect(screen.getByText('alice@org.com')).toBeInTheDocument();
    expect(screen.queryByText('bob@org.com')).not.toBeInTheDocument();
  });

  it('adds orguser chip when a member suggestion is clicked', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const input = screen.getByTestId('recipient-add-input');
    await user.click(input);

    fireEvent.mouseDown(screen.getByText('alice@org.com'));

    expect(screen.getByTestId('recipient-chip-orguser')).toBeInTheDocument();
    // both the chip and any lingering suggestion may match — chip is authoritative
    expect(screen.getByTestId('recipient-chip-orguser')).toHaveTextContent('alice@org.com');
  });

  it('adds user_group chip when a group suggestion is clicked', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const input = screen.getByTestId('recipient-add-input');
    await user.click(input);

    fireEvent.mouseDown(screen.getByText('Finance Team'));

    expect(screen.getByTestId('recipient-chip-user_group')).toBeInTheDocument();
    expect(screen.getByTestId('recipient-chip-user_group')).toHaveTextContent('Finance Team');
  });

  it('hides an already-added member from the suggestion list', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper
        initial={[
          { type: 'orguser', orguser_id: 1, orguser_name: 'alice@org.com', email: 'alice@org.com' },
        ]}
      />
    );

    const input = screen.getByTestId('recipient-add-input');
    await user.click(input);

    // alice remains rendered as the chip label but should NOT appear in the dropdown.
    // Only one "alice@org.com" node should exist (the chip), i.e. no duplicate for the suggestion.
    expect(screen.getAllByText('alice@org.com')).toHaveLength(1);
    expect(screen.getByText('bob@org.com')).toBeInTheDocument();
  });

  it('hides an already-added group from the suggestion list', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper
        initial={[{ type: 'user_group', user_group_id: 10, user_group_name: 'Finance Team' }]}
      />
    );

    const input = screen.getByTestId('recipient-add-input');
    await user.click(input);

    expect(screen.getAllByText('Finance Team')).toHaveLength(1);
    expect(screen.getByText('Data Team')).toBeInTheDocument();
  });

  it('rejects a duplicate external email', async () => {
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
    fireEvent.click(screen.getByLabelText(/remove bye@example.com/i));

    await waitFor(() => {
      expect(screen.queryByText('bye@example.com')).not.toBeInTheDocument();
    });
  });

  it('removes the last chip on Backspace when input is empty', async () => {
    const user = userEvent.setup();
    render(<Wrapper initial={[{ type: 'external', email: 'last@example.com' }]} />);

    const input = screen.getByTestId('recipient-add-input');
    input.focus();
    await user.keyboard('{Backspace}');

    await waitFor(() => {
      expect(screen.queryByText('last@example.com')).not.toBeInTheDocument();
    });
  });

  it('commits the draft email on blur (commitOnBlur)', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const input = screen.getByTestId('recipient-add-input');
    await user.type(input, 'blur@example.com');
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByText('blur@example.com')).toBeInTheDocument();
    });
  });
});
