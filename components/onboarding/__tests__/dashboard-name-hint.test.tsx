import { render, screen } from '@testing-library/react';
import { DashboardNameHint } from '../dashboard-name-hint';

describe('DashboardNameHint', () => {
  it('encourages a recognizable name without making another field required', () => {
    render(<DashboardNameHint id="name-guidance" />);

    expect(screen.getByText(/Use a clear name/)).toHaveAttribute('id', 'name-guidance');
    expect(screen.getByText(/easy to find when adding it to a dashboard/i)).toBeInTheDocument();
  });
});
