/**
 * useImpactPreflight — the shared impact fetch behind DeleteOrgDialog and
 * RemoveUserDialog. The guarantees asserted here are the ones the dialogs' safety
 * guardrail rests on, so they are tested once at the source rather than twice through
 * the UI: canConfirm stays false until real counts arrive (including when the fetch
 * fails), and a stale in-flight response can never land on the current target.
 */

import { renderHook, waitFor, act } from '@testing-library/react';

import { useImpactPreflight } from '@/components/admin/useImpactPreflight';

interface Target {
  id: number;
}

// Hoisted, not inline object literals: the hook re-fetches when the target's identity
// changes, so a fresh `{ id: 1 }` per render would refetch forever. Real callers pass
// an SWR result or a useState value, both referentially stable — see the hook's docs.
const TARGET_1: Target = { id: 1 };
const TARGET_2: Target = { id: 2 };

describe('useImpactPreflight', () => {
  it('does not fetch and cannot confirm while there is no target', () => {
    const fetchImpact = jest.fn();

    const { result } = renderHook(() => useImpactPreflight(true, null, fetchImpact));

    expect(fetchImpact).not.toHaveBeenCalled();
    expect(result.current.impact).toBeNull();
    expect(result.current.canConfirm).toBe(false);
  });

  it('does not fetch while the dialog is closed, even with a target', () => {
    const fetchImpact = jest.fn();

    renderHook(() => useImpactPreflight(false, TARGET_1, fetchImpact));

    expect(fetchImpact).not.toHaveBeenCalled();
  });

  it('blocks confirm until the counts arrive, then allows it', async () => {
    let resolveImpact: (value: { count: number }) => void = () => {};
    const fetchImpact = jest.fn(
      () =>
        new Promise<{ count: number }>((resolve) => {
          resolveImpact = resolve;
        })
    );

    const { result } = renderHook(() => useImpactPreflight(true, TARGET_1, fetchImpact));

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.canConfirm).toBe(false);

    await act(async () => {
      resolveImpact({ count: 7 });
    });

    await waitFor(() => expect(result.current.canConfirm).toBe(true));
    expect(result.current.impact).toEqual({ count: 7 });
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps confirm blocked when the fetch fails — the guardrail fails closed', async () => {
    const fetchImpact = jest.fn().mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useImpactPreflight(true, TARGET_1, fetchImpact));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.canConfirm).toBe(false);
    expect(result.current.impact).toBeNull();
  });

  it('ignores a slow response for a target that has since been replaced', async () => {
    const resolvers: Record<number, (value: { id: number }) => void> = {};
    const fetchImpact = jest.fn(
      (target: Target) =>
        new Promise<{ id: number }>((resolve) => {
          resolvers[target.id] = resolve;
        })
    );

    const { result, rerender } = renderHook(
      ({ target }: { target: Target }) => useImpactPreflight(true, target, fetchImpact),
      { initialProps: { target: TARGET_1 } }
    );

    await waitFor(() => expect(fetchImpact).toHaveBeenCalledTimes(1));

    // switch to a second target while the first request is still in flight
    rerender({ target: TARGET_2 });
    await waitFor(() => expect(fetchImpact).toHaveBeenCalledTimes(2));

    // the FIRST request now comes back late — it must not populate target 2
    await act(async () => {
      resolvers[1]({ id: 1 });
    });
    expect(result.current.impact).toBeNull();
    expect(result.current.canConfirm).toBe(false);

    await act(async () => {
      resolvers[2]({ id: 2 });
    });
    await waitFor(() => expect(result.current.impact).toEqual({ id: 2 }));
  });

  it('resets so a reopened dialog cannot confirm on the previous target’s counts', async () => {
    const fetchImpact = jest.fn().mockResolvedValue({ count: 3 });

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useImpactPreflight(open, TARGET_1, fetchImpact),
      { initialProps: { open: true } }
    );

    await waitFor(() => expect(result.current.canConfirm).toBe(true));

    rerender({ open: false });

    expect(result.current.impact).toBeNull();
    expect(result.current.canConfirm).toBe(false);
  });
});
