/**
 * Full-page (document-reloading) navigation, as opposed to Next.js client-side
 * router transitions. Use when the destination must mount on a clean document
 * load rather than into the existing SPA runtime — e.g. the free-trial progress
 * screen, whose SWR poller must not land mid-HMR/transition (see the activate page).
 *
 * Wrapped in a module so it can be mocked in tests; jsdom's window.location is not
 * reconfigurable, so the raw call is otherwise untestable.
 */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}
