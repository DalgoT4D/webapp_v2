import { ANALYTICS_EVENTS } from '@/constants/analytics';

const mockTrackEvent = jest.fn();
const mockApiPut = jest.fn();

jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
  apiDelete: jest.fn(),
  apiPublicGet: jest.fn(),
}));

import { updateDashboardSharing } from '../useDashboards';

beforeEach(() => {
  jest.clearAllMocks();
  mockApiPut.mockResolvedValue({ is_public: true, public_url: 'https://x/share/tok' });
});

describe('updateDashboardSharing analytics', () => {
  it('fires dashboard_made_public with the dashboard id when sharing is turned ON', async () => {
    await updateDashboardSharing(42, { is_public: true });

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.DASHBOARD_MADE_PUBLIC, {
      dashboard_id: 42,
    });
  });

  // Un-sharing is not an outcome we measure. Firing one event for both directions is
  // what made the old count meaningless, so this guard is the point of the change.
  it('fires nothing when sharing is turned OFF', async () => {
    mockApiPut.mockResolvedValue({ is_public: false });

    await updateDashboardSharing(42, { is_public: false });

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('does not fire if the share API call fails', async () => {
    mockApiPut.mockRejectedValue(new Error('boom'));

    await expect(updateDashboardSharing(42, { is_public: true })).rejects.toThrow('boom');
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('does not fire DASHBOARD_SHARED — that event belongs to copying the link', async () => {
    await updateDashboardSharing(42, { is_public: true });

    expect(mockTrackEvent).not.toHaveBeenCalledWith(
      ANALYTICS_EVENTS.DASHBOARD_SHARED,
      expect.anything()
    );
  });
});
