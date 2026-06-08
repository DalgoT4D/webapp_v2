import { ANALYTICS_EVENTS } from '@/constants/analytics';

const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockGroup = jest.fn();
const mockReset = jest.fn();

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    capture: (...args: unknown[]) => mockCapture(...args),
    identify: (...args: unknown[]) => mockIdentify(...args),
    group: (...args: unknown[]) => mockGroup(...args),
    reset: (...args: unknown[]) => mockReset(...args),
  },
}));

import {
  trackEvent,
  identifyUser,
  identifyOrg,
  resetAnalytics,
  isInternalEmail,
} from '@/lib/analytics';

beforeEach(() => jest.clearAllMocks());

describe('isInternalEmail', () => {
  it('flags projecttech4dev.org and dalgo.org addresses', () => {
    expect(isInternalEmail('a@projecttech4dev.org')).toBe(true);
    expect(isInternalEmail('b@dalgo.org')).toBe(true);
    expect(isInternalEmail('B@DALGO.ORG')).toBe(true);
  });
  it('does not flag external addresses', () => {
    expect(isInternalEmail('user@ngo.example')).toBe(false);
    expect(isInternalEmail('user@gmail.com')).toBe(false);
  });
});

describe('trackEvent', () => {
  it('forwards a fixed event name and properties to posthog.capture', () => {
    trackEvent(ANALYTICS_EVENTS.CHART_CREATED, { chart_type: 'bar' });
    expect(mockCapture).toHaveBeenCalledWith('chart:chart_created', { chart_type: 'bar' });
  });
  it('works with no properties', () => {
    trackEvent(ANALYTICS_EVENTS.USER_LOGGED_IN);
    expect(mockCapture).toHaveBeenCalledWith('auth:user_logged_in', undefined);
  });
});

describe('identifyUser', () => {
  it('calls posthog.identify with email as distinct_id and is_internal flag', () => {
    identifyUser('staff@dalgo.org', { role: 'account-manager' });
    expect(mockIdentify).toHaveBeenCalledWith('staff@dalgo.org', {
      email: 'staff@dalgo.org',
      is_internal: true,
      role: 'account-manager',
    });
  });
});

describe('identifyOrg', () => {
  it('calls posthog.group for the organization group type', () => {
    identifyOrg('ngo-slug', 'NGO Name');
    expect(mockGroup).toHaveBeenCalledWith('organization', 'ngo-slug', { name: 'NGO Name' });
  });
});

describe('resetAnalytics', () => {
  it('calls posthog.reset', () => {
    resetAnalytics();
    expect(mockReset).toHaveBeenCalled();
  });
});
