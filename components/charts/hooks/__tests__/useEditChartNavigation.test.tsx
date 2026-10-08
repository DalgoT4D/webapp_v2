import { renderHook } from '@testing-library/react';
import { useEditChartNavigation } from '@/components/charts/hooks/useEditChartNavigation';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

function renderNav() {
  const markSaved = jest.fn();
  const { result } = renderHook(() => useEditChartNavigation({ markSaved }));
  return { nav: result.current, markSaved };
}

describe('useEditChartNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('without an origin: push to the chart page, push to /charts', () => {
    const { nav, markSaved } = renderNav();
    expect(nav.navigationSource).toBeNull();
    expect(nav.hasNavigationSource).toBe(false);
    expect(nav.chartDetailUrl(5)).toBe('/charts/5');

    nav.navigateToChartDetail(5);
    expect(markSaved).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/charts/5');

    nav.navigateToOrigin();
    expect(mockPush).toHaveBeenLastCalledWith('/charts');
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('from a dashboard: replace to the chart page, back to the origin', () => {
    mockSearchParams = new URLSearchParams('from=dashboard');
    const { nav, markSaved } = renderNav();
    expect(nav.hasNavigationSource).toBe(true);

    nav.navigateToChartDetail(10);
    expect(mockReplace).toHaveBeenCalledWith('/charts/10?from=dashboard');

    nav.navigateToOrigin();
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(markSaved).toHaveBeenCalledTimes(2);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('navigateWithoutWarning / navigateBackWithoutWarning mark saved first', () => {
    const { nav, markSaved } = renderNav();
    nav.navigateWithoutWarning('/x');
    nav.navigateBackWithoutWarning();
    expect(markSaved).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith('/x');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
