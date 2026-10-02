import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

/**
 * Fails the run when more tests skip than the recorded budget allows.
 * A skipped test can't fail — so an accidental skip (missing creds, a stray test.skip)
 * would otherwise hide a regression behind a green run.
 *
 * Budget file: e2e/coverage/skip-budget.json  →  { "maxSkipped": 3, "allowed": ["title substring", …] }
 * Skips whose title contains an `allowed` entry don't count against the budget.
 */
const BUDGET_PATH = path.resolve(__dirname, '../coverage/skip-budget.json');

interface Budget {
  maxSkipped: number;
  allowed?: string[];
}

export default class SkipGuardReporter implements Reporter {
  private skipped: string[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'skipped') this.skipped.push(test.titlePath().slice(1).join(' › '));
  }

  async onEnd(result: FullResult): Promise<{ status?: FullResult['status'] } | undefined> {
    if (!existsSync(BUDGET_PATH)) return undefined;
    const budget = JSON.parse(readFileSync(BUDGET_PATH, 'utf8')) as Budget;
    const counted = this.skipped.filter((t) => !(budget.allowed ?? []).some((a) => t.includes(a)));

    if (counted.length > budget.maxSkipped) {
      console.error(
        `\n✘ skip guard: ${counted.length} skipped tests exceed budget of ${budget.maxSkipped}:`
      );
      for (const t of counted) console.error(`  - ${t}`);
      return { status: 'failed' };
    }
    if (result.status === 'passed')
      console.log(`✓ skip guard: ${counted.length}/${budget.maxSkipped} skips`);
    return undefined;
  }
}
