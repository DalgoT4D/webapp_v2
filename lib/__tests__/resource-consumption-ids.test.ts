import fs from 'fs';
import path from 'path';

/**
 * Cross-resource consumption events must name BOTH resources.
 *
 * Dalgo's resources are built on each other — a chart consumes a metric, a dashboard consumes
 * charts and KPIs, a report freezes a dashboard, an alert watches a metric or a KPI. Each of
 * those edges has an event, and the event is only useful if it carries both ids: the thing
 * consumed and the thing consuming it. With one id missing, the event degrades to a count —
 * "12 charts were added to dashboards" — and the questions people actually ask ("which charts
 * get reused", "which KPIs were built but never placed anywhere") become unanswerable.
 *
 * A source-reading guard rather than a runtime test: these fire from the middle of the
 * dashboard builder and a three-step alert wizard, so asserting them behaviourally means
 * driving those whole surfaces. This catches the regression that actually happens — someone
 * adds an edge, or drops an id from an existing one.
 */
const REPO = path.resolve(__dirname, '../..');

interface Edge {
  /** What consumes what, for the failure message. */
  label: string;
  file: string;
  /** The ANALYTICS_EVENTS member, as written at the call site. */
  event: string;
  /** Property names that must appear in that event's own payload object. */
  ids: string[];
}

const EDGES: Edge[] = [
  {
    label: 'a chart placed on a dashboard',
    file: 'components/dashboard/dashboard-builder-v2.tsx',
    event: 'DASHBOARD_CHART_ADDED',
    ids: ['chart_id', 'dashboard_id'],
  },
  {
    label: 'a KPI placed on a dashboard',
    file: 'components/dashboard/dashboard-builder-v2.tsx',
    event: 'DASHBOARD_KPI_ADDED',
    ids: ['kpi_id', 'dashboard_id'],
  },
  {
    label: 'a dashboard frozen into a report',
    file: 'components/reports/create-snapshot-dialog.tsx',
    event: 'REPORT_CREATED',
    ids: ['report_id', 'dashboard_id'],
  },
  {
    label: 'a dashboard copied from another',
    file: 'components/dashboard/dashboard-list-v2.tsx',
    event: 'DASHBOARD_DUPLICATED',
    ids: ['dashboard_id', 'new_dashboard_id'],
  },
  {
    label: 'a metric or KPI watched by an alert',
    file: 'components/alerts/utils.ts',
    event: 'METRIC_USED',
    ids: ['metric_id', 'alert_id'],
  },
  {
    label: 'a KPI watched by an alert',
    file: 'components/alerts/utils.ts',
    event: 'KPI_USED',
    ids: ['kpi_id', 'alert_id'],
  },
  {
    label: 'a metric charted',
    file: 'app/charts/new/configure/page.tsx',
    event: 'METRIC_USED',
    ids: ['metric_id', 'chart_id'],
  },
  {
    label: 'a metric behind a KPI',
    file: 'components/kpis/kpi-form.tsx',
    event: 'METRIC_USED',
    ids: ['metric_id', 'kpi_id'],
  },
];

/**
 * The payload object of each occurrence of `event` in `file`.
 *
 * Cuts at the first `});` after the event name, which is where a `trackEvent(EVENT, { … })`
 * call closes — so a later, unrelated event in the same file can't satisfy the assertion.
 */
function payloadsFor({ file, event }: Edge): string[] {
  const body = fs.readFileSync(path.join(REPO, file), 'utf8');
  return body
    .split(`ANALYTICS_EVENTS.${event}`)
    .slice(1)
    .map((block) => {
      const end = block.indexOf('});');
      return end === -1 ? block.slice(0, 400) : block.slice(0, end);
    });
}

describe('cross-resource consumption events carry both resource ids', () => {
  it.each(EDGES)('$label ($event) names both resources', (edge) => {
    const payloads = payloadsFor(edge);

    expect(payloads.length).toBeGreaterThan(0);
    for (const payload of payloads) {
      for (const id of edge.ids) {
        expect(payload).toContain(id);
      }
    }
  });
});
