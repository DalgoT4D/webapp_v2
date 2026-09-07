import { render } from '@testing-library/react';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

const mockTrackEvent = jest.fn();
const mockUsePublicDashboard = jest.fn();

jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock('@/hooks/api/useDashboards', () => ({
  usePublicDashboard: (token: string) => mockUsePublicDashboard(token),
}));

// The real dashboard renderer pulls in ECharts, react-grid-layout and the auth
// store — none of which matter for the view-tracking behaviour under test.
jest.mock('@/components/dashboard/dashboard-native-view', () => ({
  DashboardNativeView: () => <div data-testid="dashboard-native-view" />,
}));

import { PublicDashboardView } from '../PublicDashboardView';

const validDashboard = {
  id: 42,
  title: 'Water Access',
  is_valid: true,
  org_slug: 'ngo-slug',
  org_name: 'NGO Name',
  org_logo_url: null,
  updated_at: '2026-08-01T00:00:00Z',
  tabs: [],
  filters: [],
};

function mockDashboard(dashboard: unknown, { isLoading = false, isError = false } = {}) {
  mockUsePublicDashboard.mockReturnValue({ dashboard, isLoading, isError });
}

beforeEach(() => jest.clearAllMocks());

describe('PublicDashboardView view tracking', () => {
  it('fires public_dashboard_viewed with org_slug, org_name and dashboard_id', () => {
    mockDashboard(validDashboard);
    render(<PublicDashboardView token="tok-1" />);

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.PUBLIC_DASHBOARD_VIEWED, {
      org_slug: 'ngo-slug',
      org_name: 'NGO Name',
      dashboard_id: 42,
      is_embed: false,
    });
  });

  it('marks embed views with is_embed', () => {
    mockDashboard(validDashboard);
    render(<PublicDashboardView token="tok-1" isEmbedMode />);

    expect(mockTrackEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.PUBLIC_DASHBOARD_VIEWED,
      expect.objectContaining({ is_embed: true })
    );
  });

  it('fires once per token even when the component re-renders (SWR revalidation)', () => {
    mockDashboard(validDashboard);
    const { rerender } = render(<PublicDashboardView token="tok-1" />);
    rerender(<PublicDashboardView token="tok-1" />);
    rerender(<PublicDashboardView token="tok-1" />);

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });

  it('does not fire while the dashboard is still loading', () => {
    mockDashboard(undefined, { isLoading: true });
    render(<PublicDashboardView token="tok-1" />);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('does not fire for an expired or revoked share link', () => {
    mockDashboard({ ...validDashboard, is_valid: false });
    render(<PublicDashboardView token="tok-1" />);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('does not fire when the backend response has no org_slug (older backend)', () => {
    mockDashboard({ ...validDashboard, org_slug: undefined });
    render(<PublicDashboardView token="tok-1" />);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
