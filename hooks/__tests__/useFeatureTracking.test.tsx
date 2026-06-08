import { renderHook } from '@testing-library/react';

const mockTrackFeatureView = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackFeatureView: (...args: unknown[]) => mockTrackFeatureView(...args),
}));

let mockPathname = '/charts';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

import { useFeatureTracking } from '@/hooks/useFeatureTracking';

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/charts';
});

describe('useFeatureTracking', () => {
  it('fires feature:viewed for the current feature on mount', () => {
    renderHook(() => useFeatureTracking());
    expect(mockTrackFeatureView).toHaveBeenCalledWith('charts');
  });

  it('maps a nested path to its feature', () => {
    mockPathname = '/charts/new/configure';
    renderHook(() => useFeatureTracking());
    expect(mockTrackFeatureView).toHaveBeenCalledWith('charts');
  });

  it('maps /dashboards/usage to the superset usage feature, not dashboards', () => {
    mockPathname = '/dashboards/usage';
    renderHook(() => useFeatureTracking());
    expect(mockTrackFeatureView).toHaveBeenCalledWith('settings_superset_usage');
  });

  it('does not fire for an unmapped path (e.g. login)', () => {
    mockPathname = '/login';
    renderHook(() => useFeatureTracking());
    expect(mockTrackFeatureView).not.toHaveBeenCalled();
  });

  it('fires again when the pathname changes to a different feature', () => {
    const { rerender } = renderHook(() => useFeatureTracking());
    expect(mockTrackFeatureView).toHaveBeenCalledTimes(1);
    mockPathname = '/dashboards';
    rerender();
    expect(mockTrackFeatureView).toHaveBeenCalledWith('dashboards');
    expect(mockTrackFeatureView).toHaveBeenCalledTimes(2);
  });
});
