import { render, screen } from '@testing-library/react';
import { ResponsiveDashboardActions } from '../responsive-dashboard-actions';

jest.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isDesktop: true }),
}));

describe('ResponsiveDashboardActions', () => {
  it('gives the desktop share icon a spoken name', () => {
    render(
      <ResponsiveDashboardActions
        onShare={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        canEdit={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Share dashboard' })).toBeInTheDocument();
  });
});
