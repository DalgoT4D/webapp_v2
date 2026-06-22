import { ANALYTICS_EVENTS } from '@/constants/analytics';

const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockGroup = jest.fn();
const mockReset = jest.fn();
const mockRegister = jest.fn();
const mockSetPersonProperties = jest.fn();
const mockGetDistinctId = jest.fn();

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    capture: (...args: unknown[]) => mockCapture(...args),
    identify: (...args: unknown[]) => mockIdentify(...args),
    group: (...args: unknown[]) => mockGroup(...args),
    reset: (...args: unknown[]) => mockReset(...args),
    register: (...args: unknown[]) => mockRegister(...args),
    setPersonProperties: (...args: unknown[]) => mockSetPersonProperties(...args),
    get_distinct_id: (...args: unknown[]) => mockGetDistinctId(...args),
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
  it('forwards a fixed event name and properties to posthog.capture (non-value event)', () => {
    // A plumbing event is NOT a value action, so properties pass through untouched.
    trackEvent(ANALYTICS_EVENTS.CONNECTION_SYNC_TRIGGERED, { source_type: 'postgres' });
    expect(mockCapture).toHaveBeenCalledWith('connection:connection_sync_triggered', {
      source_type: 'postgres',
    });
  });
  it('works with no properties', () => {
    trackEvent(ANALYTICS_EVENTS.USER_LOGGED_IN);
    expect(mockCapture).toHaveBeenCalledWith('auth:user_logged_in', undefined);
  });
  it('stamps is_value_action on a value-action event, alongside its own properties', () => {
    trackEvent(ANALYTICS_EVENTS.CHART_CREATED, { chart_type: 'bar' });
    expect(mockCapture).toHaveBeenCalledWith('chart:chart_created', {
      chart_type: 'bar',
      is_value_action: true,
    });
  });
  it('stamps is_value_action even when the value event has no other properties', () => {
    trackEvent(ANALYTICS_EVENTS.KPI_ANNOTATION_CREATED);
    expect(mockCapture).toHaveBeenCalledWith('kpi:annotation_created', { is_value_action: true });
  });
  it('does NOT stamp is_value_action on a plumbing event', () => {
    trackEvent(ANALYTICS_EVENTS.PIPELINE_TRIGGERED, { is_manual: true });
    expect(mockCapture).toHaveBeenCalledWith('pipeline:pipeline_triggered', { is_manual: true });
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
  it('identifies by user_id, sets is_internal + current_role, registers role, never sends email', () => {
    mockGetDistinctId.mockReturnValue('42');
    identifyUser(42, 'staff@dalgo.org', { role: 'account-manager' });
    expect(mockIdentify).toHaveBeenCalledWith('42', {
      is_internal: true,
      current_role: 'account-manager',
      work_domain: null,
    });
    expect(mockRegister).toHaveBeenCalledWith({ role: 'account-manager' });
    const identifyArgs = mockIdentify.mock.calls[0];
    expect(JSON.stringify(identifyArgs)).not.toContain('staff@dalgo.org');
  });
  it('sends work_domain as a person property when provided', () => {
    mockGetDistinctId.mockReturnValue('7');
    identifyUser(7, 'user@ngo.example', { role: 'viewer', workDomain: 'ngo.example' });
    expect(mockIdentify).toHaveBeenCalledWith('7', {
      is_internal: false,
      current_role: 'viewer',
      work_domain: 'ngo.example',
    });
  });
  it('resets first when the current distinct_id is an old email identity, then identifies by id', () => {
    mockGetDistinctId.mockReturnValue('jake@agency.fund');
    identifyUser(101, 'jake@agency.fund', { role: 'viewer' });
    expect(mockReset).toHaveBeenCalled();
    expect(mockIdentify).toHaveBeenCalledWith('101', {
      is_internal: false,
      current_role: 'viewer',
      work_domain: null,
    });
  });
  it('does NOT reset when already identified by a numeric id', () => {
    mockGetDistinctId.mockReturnValue('60');
    identifyUser(60, 'user@ngo.example', { role: 'admin' });
    expect(mockReset).not.toHaveBeenCalled();
  });
  it('no-ops when userId is falsy (backend not yet deployed)', () => {
    identifyUser(0, 'staff@dalgo.org', { role: 'admin' });
    expect(mockIdentify).not.toHaveBeenCalled();
  });
});

describe('identifyOrg', () => {
  it('groups by organization and sets current_org_* person properties', () => {
    identifyOrg('ngo-slug', {
      name: 'NGO Name',
      plan: 'Free Trial',
      onboardedDate: '2025-01-15T00:00:00Z',
    });
    expect(mockGroup).toHaveBeenCalledWith('organization', 'ngo-slug', {
      name: 'NGO Name',
      slug: 'ngo-slug',
      subscription_plan: 'Free Trial',
      onboarded_date: '2025-01-15T00:00:00Z',
    });
    expect(mockSetPersonProperties).toHaveBeenCalledWith({
      current_org_slug: 'ngo-slug',
      current_org_name: 'NGO Name',
      current_subscription_plan: 'Free Trial',
    });
  });
});

describe('resetAnalytics', () => {
  it('calls posthog.reset', () => {
    resetAnalytics();
    expect(mockReset).toHaveBeenCalled();
  });
});
