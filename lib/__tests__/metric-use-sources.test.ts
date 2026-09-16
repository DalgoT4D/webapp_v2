import fs from 'fs';
import path from 'path';
import { METRIC_USE_SOURCES } from '@/constants/analytics';

/**
 * METRIC_USED answers "where do saved metrics actually get consumed", which only works if
 * every consuming surface fires it with its own source. Alerts were missing entirely once,
 * so this guards the set rather than any single call site: if a fourth consumer is added,
 * or a source stops being emitted, this fails and points at the gap.
 */
const REPO = path.resolve(__dirname, '../..');

// The alert wizard reports its consumption through a pure helper (alertConsumptionEvents)
// rather than inline in the submit handler, so that every alert type can be covered by unit
// tests — see components/alerts/__tests__/alert-consumption.test.ts. The guard follows the
// call, so this list names the file that actually builds the event.
const CONSUMER_FILES = [
  'app/charts/new/configure/page.tsx',
  'app/charts/[id]/edit/page.tsx',
  'components/kpis/kpi-form.tsx',
  'components/alerts/utils.ts',
];

function sourcesEmittedAcrossApp(): Set<string> {
  const found = new Set<string>();
  for (const file of CONSUMER_FILES) {
    const body = fs.readFileSync(path.join(REPO, file), 'utf8');
    for (const [key, value] of Object.entries(METRIC_USE_SOURCES)) {
      if (body.includes(`METRIC_USE_SOURCES.${key}`)) found.add(value);
    }
  }
  return found;
}

describe('METRIC_USED source coverage', () => {
  it('emits every declared source from some consuming surface', () => {
    const emitted = sourcesEmittedAcrossApp();
    const declared = Object.values(METRIC_USE_SOURCES);

    expect([...emitted].sort()).toEqual([...declared].sort());
  });

  it('fires METRIC_USED for the alert wizard (a metric_threshold alert consumes a metric)', () => {
    const body = fs.readFileSync(path.join(REPO, 'components/alerts/utils.ts'), 'utf8');

    expect(body).toContain('ANALYTICS_EVENTS.METRIC_USED');
    expect(body).toContain('METRIC_USE_SOURCES.ALERT');
  });

  it('every consuming surface sends a metric_id alongside the source', () => {
    for (const file of CONSUMER_FILES) {
      const body = fs.readFileSync(path.join(REPO, file), 'utf8');
      const blocks = body.split('ANALYTICS_EVENTS.METRIC_USED').slice(1);
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        // Inspect just the event's own property object.
        const payload = block.slice(0, block.indexOf('});'));
        expect(payload).toContain('metric_id');
        expect(payload).toContain('METRIC_USE_SOURCES.');
      }
    }
  });
});
