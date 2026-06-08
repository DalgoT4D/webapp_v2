import { ANALYTICS_EVENTS } from '@/constants/analytics';

const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockGroup = jest.fn();
const mockReset = jest.fn();
const mockRegister = jest.fn();

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    capture: (...args: unknown[]) => mockCapture(...args),
    identify: (...args: unknown[]) => mockIdentify(...args),
    group: (...args: unknown[]) => mockGroup(...args),
    reset: (...args: unknown[]) => mockReset(...args),
    register: (...args: unknown[]) => mockRegister(...args),
  },
}));

import {
  trackEvent,
  trackFeatureView,
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

describe('trackFeatureView', () => {
  it('captures feature:viewed with feature and tab', () => {
    trackFeatureView('ingest', { tab: 'sources' });
    expect(mockCapture).toHaveBeenCalledWith('feature:viewed', {
      feature: 'ingest',
      tab: 'sources',
    });
  });
  it('captures feature:viewed with feature only', () => {
    trackFeatureView('charts');
    expect(mockCapture).toHaveBeenCalledWith('feature:viewed', { feature: 'charts' });
  });
});

describe('identifyUser', () => {
  it('identifies by user_id (string), sends is_internal, registers role, never sends email', () => {
    identifyUser(42, 'staff@dalgo.org', { role: 'account-manager' });
    expect(mockIdentify).toHaveBeenCalledWith('42', { is_internal: true });
    expect(mockRegister).toHaveBeenCalledWith({ role: 'account-manager' });
    const identifyArgs = mockIdentify.mock.calls[0];
    expect(JSON.stringify(identifyArgs)).not.toContain('staff@dalgo.org');
  });
  it('no-ops when userId is falsy (backend not yet deployed)', () => {
    identifyUser(0, 'staff@dalgo.org', { role: 'admin' });
    expect(mockIdentify).not.toHaveBeenCalled();
  });
});

describe('identifyOrg', () => {
  it('calls posthog.group for the organization group type with enriched props', () => {
    identifyOrg('ngo-slug', { name: 'NGO Name', plan: 'Free Trial' });
    expect(mockGroup).toHaveBeenCalledWith('organization', 'ngo-slug', {
      name: 'NGO Name',
      slug: 'ngo-slug',
      subscription_plan: 'Free Trial',
    });
  });
});

describe('resetAnalytics', () => {
  it('calls posthog.reset', () => {
    resetAnalytics();
    expect(mockReset).toHaveBeenCalled();
  });
});
