'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Deep-link support for the "open share modal on load" flow used by
 * access-request notifications. Reads ``?openShare=true`` on the current URL.
 *
 * ``extraParamsToClear`` names additional query params that should be stripped
 * alongside ``openShare`` when the modal closes — used by list pages (KPIs)
 * that carry a resource-id param in the deep link.
 *
 * Returns:
 *   - ``initialOpen``: whether the share modal should be open on first render
 *   - ``clearParam()``: strips ``openShare`` + any extras without touching
 *     unrelated query params so a refresh after close doesn't reopen the modal
 */
export function useOpenShareDeepLink(extraParamsToClear: string[] = []) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialOpen = searchParams.get('openShare') === 'true';

  const clearParam = () => {
    if (!searchParams.get('openShare')) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('openShare');
    extraParamsToClear.forEach((p) => params.delete(p));
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };

  return { initialOpen, clearParam };
}
