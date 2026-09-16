import { render } from '@testing-library/react';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

const mockTrackEvent = jest.fn();
const mockUsePublicReport = jest.fn();

jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock('@/hooks/api/useReports', () => ({
  usePublicReport: (token: string) => mockUsePublicReport(token),
}));

// The real renderers pull in ECharts, react-grid-layout and the auth store — none of which
// matter for the view-tracking behaviour under test.
jest.mock('@/components/dashboard/dashboard-native-view', () => ({
  DashboardNativeView: () => <div data-testid="dashboard-native-view" />,
}));
jest.mock('@/components/reports/print-layout', () => ({
  PrintLayout: () => <div data-testid="print-layout" />,
}));

import { PublicReportView } from '../PublicReportView';

const validReport = {
  is_valid: true,
  org_name: 'NGO Name',
  org_slug: 'ngo-slug',
  org_logo_url: null,
  dashboard_data: { tabs: [], filters: [] },
  frozen_chart_configs: {},
  report_metadata: {
    snapshot_id: 7,
    title: 'Quarterly Impact',
    period_start: '2026-04-01',
    period_end: '2026-06-30',
    created_by: null,
  },
};

function mockReport(viewData: unknown, { isLoading = false, isError = false } = {}) {
  mockUsePublicReport.mockReturnValue({ viewData, isLoading, isError, mutate: jest.fn() });
}

beforeEach(() => jest.clearAllMocks());

describe('PublicReportView view tracking', () => {
  it('fires public_report_viewed with org_slug, org_name and report_id', () => {
    mockReport(validReport);
    render(<PublicReportView token="tok-1" />);

    // org_slug is what makes an anonymous read attributable to an org — org_name can be
    // renamed, so it cannot be joined on. Same payload shape as the public dashboard.
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.PUBLIC_REPORT_VIEWED, {
      org_slug: 'ngo-slug',
      org_name: 'NGO Name',
      report_id: 7,
    });
  });

  it('fires once per token even when the component re-renders (SWR revalidation)', () => {
    mockReport(validReport);
    const { rerender } = render(<PublicReportView token="tok-1" />);
    rerender(<PublicReportView token="tok-1" />);
    rerender(<PublicReportView token="tok-1" />);

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire on the print-mode render — that pass is a PDF capture, not a human read', () => {
    mockReport(validReport);
    render(<PublicReportView token="tok-1" printMode />);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('does NOT fire for an invalid or expired link', () => {
    mockReport({ ...validReport, is_valid: false });
    render(<PublicReportView token="tok-1" />);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('does NOT fire while the payload is still loading', () => {
    mockReport(undefined, { isLoading: true });
    render(<PublicReportView token="tok-1" />);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
