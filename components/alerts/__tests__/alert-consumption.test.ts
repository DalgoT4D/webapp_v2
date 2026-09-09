import { ANALYTICS_EVENTS, KPI_USE_SOURCES, METRIC_USE_SOURCES } from '@/constants/analytics';
import { AlertType } from '@/types/alerts';
import { alertConsumptionEvents } from '../utils';

/**
 * An alert is built ON something — a metric, a KPI, or nothing (standalone). That "something"
 * being consumed is the adoption signal: it is how "which metrics/KPIs do people actually
 * build on" gets answered. Metrics already reported it; KPIs did not, so KPI adoption
 * undercounted alerts entirely.
 *
 * Kept as a pure function rather than inline in the wizard's submit handler so every alert
 * type can be covered without driving a three-step form.
 */
describe('alertConsumptionEvents', () => {
  it('reports a metric_threshold alert as consuming its metric', () => {
    expect(
      alertConsumptionEvents(AlertType.METRIC_THRESHOLD, { metricId: 12, kpiId: null }, 99)
    ).toEqual([
      {
        event: ANALYTICS_EVENTS.METRIC_USED,
        properties: { metric_id: 12, alert_id: 99, source: METRIC_USE_SOURCES.ALERT },
      },
    ]);
  });

  it('reports a kpi_rag alert as consuming its KPI', () => {
    expect(alertConsumptionEvents(AlertType.KPI_RAG, { metricId: null, kpiId: 5 }, 99)).toEqual([
      {
        event: ANALYTICS_EVENTS.KPI_USED,
        properties: { kpi_id: 5, alert_id: 99, source: KPI_USE_SOURCES.ALERT },
      },
    ]);
  });

  it('reports nothing for a standalone alert — it is built on a warehouse table, not a resource', () => {
    expect(
      alertConsumptionEvents(AlertType.STANDALONE, { metricId: null, kpiId: null }, 99)
    ).toEqual([]);
  });

  it('ignores the id belonging to the other alert type', () => {
    // The wizard keeps both ids in state, so a user who switches type mid-form leaves the
    // previous one set. Reporting it would credit a resource this alert does not use.
    expect(alertConsumptionEvents(AlertType.KPI_RAG, { metricId: 12, kpiId: 5 }, 99)).toEqual([
      {
        event: ANALYTICS_EVENTS.KPI_USED,
        properties: { kpi_id: 5, alert_id: 99, source: KPI_USE_SOURCES.ALERT },
      },
    ]);
  });

  it('reports nothing when the required id is missing', () => {
    expect(alertConsumptionEvents(AlertType.KPI_RAG, { metricId: null, kpiId: null }, 99)).toEqual(
      []
    );
    expect(
      alertConsumptionEvents(AlertType.METRIC_THRESHOLD, { metricId: null, kpiId: 5 }, 99)
    ).toEqual([]);
  });

  it('still reports the consumption when the created id is unknown', () => {
    // The create response is typed optional. Losing the join is better than losing the
    // adoption signal entirely, so the event fires with an undefined alert_id.
    expect(
      alertConsumptionEvents(AlertType.KPI_RAG, { metricId: null, kpiId: 5 }, undefined)
    ).toEqual([
      {
        event: ANALYTICS_EVENTS.KPI_USED,
        properties: { kpi_id: 5, alert_id: undefined, source: KPI_USE_SOURCES.ALERT },
      },
    ]);
  });
});
