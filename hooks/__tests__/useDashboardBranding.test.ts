import { renderHook } from '@testing-library/react';
import useSWR from 'swr';

import { useDashboardBranding } from '../api/useDashboardBranding';
import { apiGet } from '@/lib/api';

jest.mock('swr');
jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
}));

describe('useDashboardBranding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('uses initial branding as the authoritative source when provided', () => {
    (useSWR as jest.Mock).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    });

    localStorage.setItem('dalgo_org_logo_url', 'https://example.com/local-logo.png');
    localStorage.setItem('dalgo_org_logo_width', '96');

    const initialBranding = {
      dashboard_logo_url: null,
      dashboard_logo_width: 124,
      chart_palette_name: 'Shared Palette',
      chart_palette_colors: ['#112233', '#445566'],
    };

    const { result } = renderHook(() =>
      useDashboardBranding({
        enabled: false,
        initialBranding,
      })
    );

    expect(useSWR).toHaveBeenCalledWith(null, apiGet, { revalidateOnFocus: false });
    expect(result.current.branding).toEqual(initialBranding);
  });

  it('falls back to locally stored logo when backend branding is unavailable', () => {
    (useSWR as jest.Mock).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    });

    localStorage.setItem('dalgo_org_logo_url', 'https://example.com/local-logo.png');
    localStorage.setItem('dalgo_org_logo_width', '88');

    const { result } = renderHook(() => useDashboardBranding());

    expect(result.current.branding).toEqual({
      dashboard_logo_url: 'https://example.com/local-logo.png',
      dashboard_logo_width: 88,
      chart_palette_name: null,
      chart_palette_colors: null,
    });
  });
});
