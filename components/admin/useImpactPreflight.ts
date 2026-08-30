'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The impact preflight shared by the admin portal's destructive confirm dialogs
 * (DeleteOrgDialog, RemoveUserDialog). Both fetched the same way and guarded the same
 * way in two copies; the guarantee below is a safety invariant, so it lives in one
 * place rather than being restated per dialog.
 *
 * SAFETY GUARDRAIL (non-negotiable): the admin must see what the action will affect
 * BEFORE it is allowed. `canConfirm` stays false until the counts have actually
 * loaded — so a failed or still-in-flight impact fetch blocks the action rather than
 * letting it through blind.
 *
 * Pass `target: null` when there is nothing selected yet: nothing is fetched and the
 * state resets. An in-flight fetch is abandoned when the dialog closes or the target
 * changes, so a slow response for a previous target can never land on the current one.
 *
 * `target` must be referentially STABLE across renders — the refetch keys on its
 * identity, so a fresh object literal built inline each render would refetch forever.
 * Both callers satisfy this already (an SWR result, a useState value). `fetchImpact`
 * has no such constraint: it is held in a ref precisely so callers can define it
 * inline, closing over props like orgId.
 */
export function useImpactPreflight<TTarget, TImpact>(
  open: boolean,
  target: TTarget | null,
  fetchImpact: (target: TTarget) => Promise<TImpact>
) {
  const [impact, setImpact] = useState<TImpact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  // Callers build the fetcher inline (it closes over orgId etc.), so its identity
  // changes every render. Hold it in a ref and key the effect on the target instead,
  // otherwise the effect would re-fire in a loop.
  const fetchImpactRef = useRef(fetchImpact);
  fetchImpactRef.current = fetchImpact;

  useEffect(() => {
    if (!open || target === null) {
      setImpact(null);
      setIsError(false);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    setImpact(null);

    fetchImpactRef
      .current(target)
      .then((data) => {
        if (!cancelled) setImpact(data);
      })
      .catch(() => {
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, target]);

  return {
    impact,
    isLoading,
    isError,
    /** True only once the counts are on screen — wire this to the confirm button. */
    canConfirm: impact !== null,
  };
}
