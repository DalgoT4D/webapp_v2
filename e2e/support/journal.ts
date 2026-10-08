import { createHash } from 'crypto';
import { expect, test } from '@playwright/test';
import { PAYLOAD_SNAPSHOTS_ENABLED } from './env';

/**
 * Snapshot journal — ONE baseline file per test instead of one per step.
 *
 * Multi-step tests (permutations: switch → switch back → save …) record each step's state in order;
 * the `fixtures.ts` auto-fixture writes the whole ordered list as `<test title>.journal.json` when a
 * test passes. Same strictness as per-step snapshots, far fewer files, and one file tells the story.
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface JournalEntry {
  step: string;
  kind: 'ui' | 'request' | 'diff';
  value: Json;
}

const journals = new Map<string, JournalEntry[]>();

/** Append one step to the running test's journal (no-op when baselines are switched off). */
export function journal(step: string, kind: JournalEntry['kind'], value: Json) {
  if (!PAYLOAD_SNAPSHOTS_ENABLED) return;
  const { testId } = test.info();
  const entries = journals.get(testId) ?? [];
  entries.push({ step, kind, value });
  journals.set(testId, entries);
}

// macOS/Linux cap file names at 255 bytes; [pinned] titles carry long explanations after " — "
const MAX_NAME_CHARS = 100;
const HASH_CHARS = 8;

function journalFileName(titlePath: string[]): string {
  // titlePath[0] is the file; the rest (describes + title) is unique within the file
  const full = titlePath.slice(1).join(' ');
  const short = full
    .split(' — ')[0]
    .replace(/→/g, 'to')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, MAX_NAME_CHARS);
  // Hash of the full title keeps names unique even when the readable part is truncated
  const hash = createHash('sha1').update(full).digest('hex').slice(0, HASH_CHARS);
  return `${short}-${hash}`;
}

/** Compare the test's journal against its baseline. Called by the auto-fixture after each test. */
export function flushJournal() {
  const info = test.info();
  const entries = journals.get(info.testId);
  journals.delete(info.testId);
  // Only baseline a passing test — a failed test's partial journal would be misleading
  if (!entries?.length || info.status !== info.expectedStatus) return;
  expect(JSON.stringify(entries, null, 2)).toMatchSnapshot(
    `${journalFileName(info.titlePath)}.journal.json`
  );
}
