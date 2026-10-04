#!/usr/bin/env node
/**
 * Test inventory lock — guarantees the refactor can't silently drop E2E tests.
 *
 *   node e2e/scripts/test-inventory.mjs record   # snapshot current test list (pre-refactor)
 *   node e2e/scripts/test-inventory.mjs verify   # fail if any recorded test is missing/renamed
 *
 * Tests are identified by project › file › describe path › title (line numbers ignored),
 * so moving a test within its file is fine; renaming or deleting it is not.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const INVENTORY_PATH = path.resolve('e2e/coverage/test-inventory.txt');
// e.g. "  [chromium] › charts/list.spec.ts:12:7 › chart list › C-L1 loads"
const LIST_LINE = /^\s*\[([^\]]+)\] › (.+?):\d+:\d+ › (.+)$/;

function currentTests() {
  const out = execFileSync('npx', ['playwright', 'test', '--list'], {
    encoding: 'utf8',
    env: { ...process.env, E2E_BASE_URL: process.env.E2E_BASE_URL || 'http://localhost:3001' },
    maxBuffer: 64 * 1024 * 1024,
  });
  const tests = new Set();
  for (const line of out.split('\n')) {
    const m = LIST_LINE.exec(line);
    if (!m) continue;
    const [, project, file, title] = m;
    if (project === 'setup' || project === 'teardown') continue;
    tests.add(`[${project}] ${file} › ${title}`);
  }
  return [...tests].sort();
}

const mode = process.argv[2];

if (mode === 'record') {
  const tests = currentTests();
  writeFileSync(INVENTORY_PATH, tests.join('\n') + '\n');
  console.log(`Recorded ${tests.length} tests → ${path.relative(process.cwd(), INVENTORY_PATH)}`);
} else if (mode === 'verify') {
  if (!existsSync(INVENTORY_PATH)) {
    console.error('No inventory recorded. Run: node e2e/scripts/test-inventory.mjs record');
    process.exit(1);
  }
  const recorded = readFileSync(INVENTORY_PATH, 'utf8').split('\n').filter(Boolean);
  const current = new Set(currentTests());
  const missing = recorded.filter((t) => !current.has(t));
  const added = [...current].filter((t) => !recorded.includes(t));

  if (added.length) console.log(`+ ${added.length} new test(s) (fine — re-record to lock them in)`);
  if (missing.length) {
    console.error(`\n✘ ${missing.length} recorded test(s) are missing or renamed:\n`);
    for (const t of missing) console.error(`  - ${t}`);
    process.exit(1);
  }
  console.log(`✓ all ${recorded.length} recorded tests present`);
} else {
  console.error('usage: test-inventory.mjs record|verify');
  process.exit(2);
}
