import { render, screen } from '@testing-library/react';
import { NoAccess } from '@/components/no-access';

describe('NoAccess', () => {
  it('shows a message directing the user to contact their org admin', () => {
    render(<NoAccess />);
    expect(screen.getByText(/contact your org admin/i)).toBeInTheDocument();
  });
});
