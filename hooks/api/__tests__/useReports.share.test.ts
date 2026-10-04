import { ANALYTICS_EVENTS, REPORT_SHARE_SOURCES } from '@/constants/analytics';

const mockTrackEvent = jest.fn();
const mockApiPut = jest.fn();
const mockApiPost = jest.fn();

jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
  apiDelete: jest.fn(),
  apiPublicGet: jest.fn(),
}));

import { createSnapshot, shareReportViaEmail } from '../useReports';

beforeEach(() => {
  jest.clearAllMocks();
  mockApiPut.mockResolvedValue({ data: { is_public: true, public_url: 'https://x/share/tok' } });
  mockApiPost.mockResolvedValue({ data: { id: 9, recipients_count: 2 } });
});

describe('shareReportViaEmail analytics', () => {
  it('fires report_shared with the email source and a recipient COUNT, never addresses', async () => {
    await shareReportViaEmail(42, {
      recipient_emails: ['a@ngo.org', 'b@ngo.org'],
      message: 'hello',
    });

    expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.REPORT_SHARED, {
      report_id: 42,
      source: REPORT_SHARE_SOURCES.EMAIL,
      recipients_count: 2,
    });
    // The addresses are PII — assert they cannot reach PostHog via this event.
    expect(JSON.stringify(mockTrackEvent.mock.calls)).not.toContain('@ngo.org');
  });
});

describe('createSnapshot analytics', () => {
  // REPORT_CREATED belongs to the GENERATE REPORT handler, which has the returned id.
  it('does not fire REPORT_CREATED from the hook', async () => {
    await createSnapshot({ title: 'Q3', dashboard_id: 5 });

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
