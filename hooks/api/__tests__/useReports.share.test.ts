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

import { createSnapshot, shareReportViaEmail, updateReportSharing } from '../useReports';

beforeEach(() => {
  jest.clearAllMocks();
  mockApiPut.mockResolvedValue({ data: { is_public: true, public_url: 'https://x/share/tok' } });
  mockApiPost.mockResolvedValue({ data: { id: 9, recipients_count: 2 } });
});

describe('updateReportSharing analytics', () => {
  it('fires report_made_public with the report id when sharing is turned ON', async () => {
    await updateReportSharing(42, { is_public: true });

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.REPORT_MADE_PUBLIC, {
      report_id: 42,
    });
  });

  // Mirrors the dashboard rule: one event for both directions made the total meaningless.
  it('fires nothing when sharing is turned OFF', async () => {
    mockApiPut.mockResolvedValue({ data: { is_public: false } });

    await updateReportSharing(42, { is_public: false });

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('does not fire REPORT_SHARED — that belongs to copying the link or emailing', async () => {
    await updateReportSharing(42, { is_public: true });

    expect(mockTrackEvent).not.toHaveBeenCalledWith(
      ANALYTICS_EVENTS.REPORT_SHARED,
      expect.anything()
    );
  });

  it('does not fire if the share API call fails', async () => {
    mockApiPut.mockRejectedValue(new Error('boom'));

    await expect(updateReportSharing(42, { is_public: true })).rejects.toThrow('boom');
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
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
