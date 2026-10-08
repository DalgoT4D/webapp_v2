import type { BrowserContext, TestInfo } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'fs';
import path from 'path';

/**
 * Interaction recorder — which `data-testid` elements did each test actually interact with?
 *
 * Off by default (zero overhead). `E2E_RECORD_INTERACTIONS=on` installs capture-phase, passive
 * listeners in every page of the test's browser contexts (the `page` fixture's context and every
 * `pageAs` context) and reports the testid of the nearest `[data-testid]` ancestor of each event
 * target (plus the next testid ancestor above it, which covers a testid'd icon/span inside a
 * testid'd button or item), with the page pathname it happened on. One JSON line per test is appended to
 * `test-results/interactions/<runId>-<workerIndex>.jsonl`; `npm run e2e:interactions:report` turns
 * them into e2e/coverage/INTERACTIONS.md.
 *
 * Not recorded: pages from contexts a spec creates itself with `browser.newContext()`.
 */

export const RECORD_INTERACTIONS = process.env.E2E_RECORD_INTERACTIONS === 'on';

export const INTERACTIONS_DIR = path.resolve(__dirname, '../../test-results/interactions');

const BINDING = '__e2eTouched';

/** testid → pathnames it was interacted with on (lets the report tell create/edit page copies apart) */
export type Touched = Map<string, Set<string>>;

/** Browser side. Serialized by addInitScript — must be self-contained. */
function recorderScript(binding: string) {
  const w = window as unknown as Record<string, unknown> & { __e2eRecorderInstalled?: boolean };
  if (w.__e2eRecorderInstalled) return;
  w.__e2eRecorderInstalled = true;

  const KEYS = new Set([
    'Enter',
    ' ',
    'Spacebar',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Escape',
    'Tab',
  ]);

  const report = (event: Event) => {
    try {
      if (event.type === 'keydown' && !KEYS.has((event as KeyboardEvent).key)) return;
      let node = event.target as Node | null;
      if (node && node.nodeType !== 1) node = node.parentElement;
      const el = node as Element | null;
      if (!el || typeof el.closest !== 'function') return;
      const own = el.closest('[data-testid]');
      if (!own) return;
      const ids = [own.getAttribute('data-testid')];
      // Next testid'd ancestor (e.g. item → its menu content inside a Radix portal)
      const parent = own.parentElement?.closest('[data-testid]');
      if (parent) ids.push(parent.getAttribute('data-testid'));
      const send = w[binding];
      if (typeof send === 'function') {
        // Binding returns a promise; never let a rejection surface in the app
        const result = (send as (ids: unknown[], at: string) => Promise<void>)(
          ids,
          location.pathname
        );
        if (result && typeof result.catch === 'function') result.catch((): void => undefined);
      }
    } catch {
      /* never affect the app */
    }
  };

  for (const type of ['click', 'dblclick', 'pointerdown', 'input', 'change', 'keydown']) {
    window.addEventListener(type, report, { capture: true, passive: true });
  }
}

/** Node side: expose the binding and inject the listeners into every page of `context`. */
export async function installInteractionRecorder(context: BrowserContext, touched: Touched) {
  if (!RECORD_INTERACTIONS) return;
  await context.exposeBinding(BINDING, (_source, ids: unknown, at: unknown) => {
    if (!Array.isArray(ids)) return;
    const pathname = typeof at === 'string' ? at : '';
    for (const id of ids) {
      if (typeof id !== 'string' || !id) continue;
      const paths = touched.get(id) ?? new Set<string>();
      paths.add(pathname);
      touched.set(id, paths);
    }
  });
  await context.addInitScript(recorderScript, BINDING);
}

/** Appends this test's touched testids as one JSON line. */
export function flushInteractions(testInfo: TestInfo, touched: Touched) {
  if (!RECORD_INTERACTIONS) return;
  try {
    mkdirSync(INTERACTIONS_DIR, { recursive: true });
    const line = {
      test: testInfo.titlePath.join(' › '),
      file: path.relative(path.resolve(__dirname, '../..'), testInfo.file),
      project: testInfo.project.name,
      status: testInfo.status,
      ids: [...touched.keys()].sort(),
      at: Object.fromEntries([...touched].map(([id, paths]) => [id, [...paths].sort()])),
    };
    const out = path.join(
      INTERACTIONS_DIR,
      `${process.env.E2E_RUN_ID || 'run'}-${testInfo.workerIndex}.jsonl`
    );
    appendFileSync(out, JSON.stringify(line) + '\n');
  } catch {
    /* recording must never fail a test */
  }
}
