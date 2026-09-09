import {
  ANALYTICS_EVENTS,
  KPI_USE_SOURCES,
  METRIC_USE_SOURCES,
  type AnalyticsEvent,
} from '@/constants/analytics';
import { AlertType } from '@/types/alerts';

interface ConsumptionEvent {
  event: AnalyticsEvent;
  properties: Record<string, unknown>;
}

/**
 * What this alert consumes, as the analytics events to fire for it.
 *
 * An alert is built ON something — a metric (`metric_threshold`), a KPI (`kpi_rag`), or a
 * warehouse table (`standalone`, which consumes no saved resource). That consumption is the
 * adoption signal behind "which metrics and KPIs do people actually build on", and it is the
 * only place an alert can be joined back to the resource it watches: `alert_created` carries
 * the alert's own id and type, not the id of its source.
 *
 * A pure function rather than inline in the wizard's submit handler so every alert type is
 * covered by tests without driving a three-step form.
 *
 * Both ids are read from the same wizard state, so a user who switches type mid-form leaves
 * the other one set — hence the type, not the presence of an id, decides what is reported.
 */
export function alertConsumptionEvents(
  alertType: AlertType,
  { metricId, kpiId }: { metricId: number | null; kpiId: number | null },
  alertId: number | undefined
): ConsumptionEvent[] {
  if (alertType === AlertType.METRIC_THRESHOLD && metricId) {
    return [
      {
        event: ANALYTICS_EVENTS.METRIC_USED,
        properties: { metric_id: metricId, alert_id: alertId, source: METRIC_USE_SOURCES.ALERT },
      },
    ];
  }
  if (alertType === AlertType.KPI_RAG && kpiId) {
    return [
      {
        event: ANALYTICS_EVENTS.KPI_USED,
        properties: { kpi_id: kpiId, alert_id: alertId, source: KPI_USE_SOURCES.ALERT },
      },
    ];
  }
  return [];
}
