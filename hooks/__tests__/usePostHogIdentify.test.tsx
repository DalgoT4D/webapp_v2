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
  getCurrentOrgUser: () => {
    user_id: number;
    email: string;
    new_role_slug: string;
    subscription_plan?: string | null;
  } | null;
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
  authState.getCurrentOrgUser = () => ({
    user_id: 42,
    email: 'u@ngo.example',
    new_role_slug: 'admin',
    subscription_plan: 'Free Trial',
  });

  renderHook(() => usePostHogIdentify());

  expect(mockIdentifyUser).toHaveBeenCalledWith(42, 'u@ngo.example', {
    role: 'admin',
  });
  expect(mockIdentifyOrg).toHaveBeenCalledWith('ngo-1', {
    name: 'NGO One',
    plan: 'Free Trial',
    onboardedDate: null,
  });
  expect(mockResetAnalytics).not.toHaveBeenCalled();
});

it('does not identify when unauthenticated', () => {
  renderHook(() => usePostHogIdentify());
  expect(mockIdentifyUser).not.toHaveBeenCalled();
  expect(mockIdentifyOrg).not.toHaveBeenCalled();
});

it('does not re-identify the user when user_id is unchanged, but re-identifies when it changes', () => {
  authState.isAuthenticated = true;
  authState.currentOrg = { slug: 'ngo-1', name: 'NGO One' };
  authState.getCurrentOrgUser = () => ({
    user_id: 42,
    email: 'u@ngo.example',
    new_role_slug: 'admin',
    subscription_plan: 'Free Trial',
  });

  const { rerender } = renderHook(() => usePostHogIdentify());
  expect(mockIdentifyUser).toHaveBeenCalledTimes(1);

  // Re-render with the same user_id — identifyUser must not fire again.
  rerender();
  expect(mockIdentifyUser).toHaveBeenCalledTimes(1);

  // Switch to a different user_id — identifyUser must fire again.
  authState.getCurrentOrgUser = () => ({
    user_id: 99,
    email: 'other@ngo.example',
    new_role_slug: 'admin',
    subscription_plan: null,
  });
  rerender();
  expect(mockIdentifyUser).toHaveBeenCalledTimes(2);
  expect(mockIdentifyUser).toHaveBeenLastCalledWith(99, 'other@ngo.example', {
    role: 'admin',
  });
});

it('re-identifies on org switch (same user_id) so the role super-property refreshes', () => {
  authState.isAuthenticated = true;
  authState.currentOrg = { slug: 'ngo-1', name: 'NGO One' };
  authState.getCurrentOrgUser = () => ({
    user_id: 42,
    email: 'u@ngo.example',
    new_role_slug: 'admin',
    subscription_plan: 'Free Trial',
  });

  const { rerender } = renderHook(() => usePostHogIdentify());
  expect(mockIdentifyUser).toHaveBeenCalledTimes(1);

  // Same user switches to a different org where they hold a different role.
  authState.currentOrg = { slug: 'ngo-2', name: 'NGO Two' };
  authState.getCurrentOrgUser = () => ({
    user_id: 42,
    email: 'u@ngo.example',
    new_role_slug: 'admin',
    subscription_plan: 'Paid',
  });
  rerender();

  // identifyUser must fire again so the registered role is updated to 'admin'.
  expect(mockIdentifyUser).toHaveBeenCalledTimes(2);
  expect(mockIdentifyUser).toHaveBeenLastCalledWith(42, 'u@ngo.example', { role: 'admin' });
  expect(mockIdentifyOrg).toHaveBeenLastCalledWith('ngo-2', {
    name: 'NGO Two',
    plan: 'Paid',
    onboardedDate: null,
  });
});
