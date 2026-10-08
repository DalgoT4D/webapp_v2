import { act, renderHook } from '@testing-library/react';
import {
  useCurrentOrgUser,
  CURRENT_USER_KEY,
} from '@/components/dashboard/hooks/useCurrentOrgUser';
import { useLandingPageActions } from '@/components/dashboard/hooks/useLandingPageActions';

const mockUseSWR = jest.fn();
const mockSwrMutate = jest.fn();
jest.mock('swr', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockUseSWR(...args),
  mutate: (...args: unknown[]) => mockSwrMutate(...args),
}));

const storeUser = { email: 'store@ngo.org', org: { slug: 'org-a' } };
const mockAuthState = { getCurrentOrgUser: () => storeUser, selectedOrgSlug: 'org-b' };
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));

const calls: string[] = [];
const mockLanding = {
  setPersonalLanding: jest.fn(
    async (id: number): Promise<void> => void calls.push(`setPersonal:${id}`)
  ),
  removePersonalLanding: jest.fn(async (): Promise<void> => void calls.push('removePersonal')),
  setOrgDefault: jest.fn(
    async (id: number): Promise<void> => void calls.push(`setOrgDefault:${id}`)
  ),
  isLoading: false,
};
jest.mock('@/hooks/api/useLandingPage', () => ({ useLandingPage: () => mockLanding }));

beforeEach(() => {
  jest.clearAllMocks();
  calls.length = 0;
  mockSwrMutate.mockImplementation(async (key: string) => void calls.push(`swrMutate:${key}`));
});

describe('useCurrentOrgUser', () => {
  it('prefers the fresh currentuserv2 row of the selected org', () => {
    const fresh = { email: 'fresh@ngo.org', org: { slug: 'org-b' }, landing_dashboard_id: 7 };
    mockUseSWR.mockReturnValue({ data: [{ email: 'x', org: { slug: 'org-a' } }, fresh] });
    const { result } = renderHook(() => useCurrentOrgUser());
    expect(result.current).toBe(fresh);
    expect(mockUseSWR.mock.calls[0][0]).toBe(CURRENT_USER_KEY);
    expect(mockUseSWR.mock.calls[0][2]).toEqual({
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    });
  });

  it('falls back to the auth store user', () => {
    mockUseSWR.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useCurrentOrgUser());
    expect(result.current).toBe(storeUser);
  });

  it('public mode: no request, no user', () => {
    mockUseSWR.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useCurrentOrgUser(true));
    expect(result.current).toBeNull();
    expect(mockUseSWR.mock.calls[0][0]).toBeNull();
  });
});

describe('useLandingPageActions', () => {
  it('runs the action, re-fetches the current user, then calls onLandingChanged', async () => {
    const onLandingChanged = jest.fn((): void => void calls.push('changed'));
    const { result } = renderHook(() => useLandingPageActions(onLandingChanged));
    await act(() => result.current.setMyLanding(5));
    await act(() => result.current.removeMyLanding());
    await act(() => result.current.makeOrgDefault(9));
    expect(calls).toEqual([
      'setPersonal:5',
      `swrMutate:${CURRENT_USER_KEY}`,
      'changed',
      'removePersonal',
      `swrMutate:${CURRENT_USER_KEY}`,
      'changed',
      'setOrgDefault:9',
      `swrMutate:${CURRENT_USER_KEY}`,
      'changed',
    ]);
    expect(result.current.isLandingPageLoading).toBe(false);
  });

  it('works without onLandingChanged (view page)', async () => {
    const { result } = renderHook(() => useLandingPageActions());
    await act(() => result.current.setMyLanding(5));
    expect(calls).toEqual(['setPersonal:5', `swrMutate:${CURRENT_USER_KEY}`]);
  });
});
