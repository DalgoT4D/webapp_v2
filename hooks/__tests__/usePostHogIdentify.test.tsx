import { renderHook } from '@testing-library/react';

const mockIdentifyUser = jest.fn();
const mockIdentifyOrg = jest.fn();
const mockResetAnalytics = jest.fn();

jest.mock('@/lib/analytics', () => ({
  identifyUser: (...a: unknown[]) => mockIdentifyUser(...a),
  identifyOrg: (...a: unknown[]) => mockIdentifyOrg(...a),
  resetAnalytics: (...a: unknown[]) => mockResetAnalytics(...a),
}));

let authState: {
  isAuthenticated: boolean;
  currentOrg: { slug: string; name: string } | null;
  getCurrentOrgUser: () => { email: string; new_role_slug: string } | null;
};

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

import { usePostHogIdentify } from '@/hooks/usePostHogIdentify';

beforeEach(() => {
  jest.clearAllMocks();
  authState = {
    isAuthenticated: false,
    currentOrg: null,
    getCurrentOrgUser: () => null,
  };
});

it('identifies user and org when authenticated', () => {
  authState.isAuthenticated = true;
  authState.currentOrg = { slug: 'ngo-1', name: 'NGO One' };
  authState.getCurrentOrgUser = () => ({ email: 'u@ngo.example', new_role_slug: 'admin' });

  renderHook(() => usePostHogIdentify());

  expect(mockIdentifyUser).toHaveBeenCalledWith('u@ngo.example', { role: 'admin' });
  expect(mockIdentifyOrg).toHaveBeenCalledWith('ngo-1', 'NGO One');
  expect(mockResetAnalytics).not.toHaveBeenCalled();
});

it('does not identify when unauthenticated', () => {
  renderHook(() => usePostHogIdentify());
  expect(mockIdentifyUser).not.toHaveBeenCalled();
  expect(mockIdentifyOrg).not.toHaveBeenCalled();
});
