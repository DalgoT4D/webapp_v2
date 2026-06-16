// Alert types — mirror ddpui/schemas/alert_schema.py

/* TS lets a const and a type share a name. Each enum below exposes both:
 *   - `AlertType.KPI_RAG` → the literal "kpi_rag" (use this in code)
 *   - `AlertType`        → the union "metric_threshold" | "kpi_rag" | "standalone"
 * Mirrors `ddpui.models.alert.AlertType`. */
export const AlertType = {
  METRIC_THRESHOLD: 'metric_threshold',
  KPI_RAG: 'kpi_rag',
  STANDALONE: 'standalone',
} as const;
export type AlertType = (typeof AlertType)[keyof typeof AlertType];

export const AlertChannel = {
  EMAIL: 'email',
  SLACK: 'slack',
} as const;
export type AlertChannel = (typeof AlertChannel)[keyof typeof AlertChannel];

export const ThresholdOperator = {
  LT: 'lt',
  GT: 'gt',
  EQ: 'eq',
} as const;
export type ThresholdOperator = (typeof ThresholdOperator)[keyof typeof ThresholdOperator];

export const RagStateEnum = {
  RED: 'red',
  AMBER: 'amber',
  GREEN: 'green',
} as const;
export type RagState = (typeof RagStateEnum)[keyof typeof RagStateEnum];

export interface ThresholdCondition {
  operator: ThresholdOperator;
  value: number;
}

export interface RagCondition {
  rag_states: RagState[];
}

export type AlertCondition = ThresholdCondition | RagCondition;

export interface FilterClause {
  column: string;
  operator: string;
  value: unknown;
}

export interface StandaloneConfig {
  schema_name: string;
  table_name: string;
  column?: string | null;
  aggregation?: string | null;
  column_expression?: string | null;
  filters?: FilterClause[];
}

export interface RecipientIn {
  type: 'orguser' | 'external';
  orguser_id?: number | null;
  email?: string | null;
}

export interface RecipientOut {
  type: 'orguser' | 'external';
  orguser_id?: number | null;
  orguser_name?: string | null;
  email?: string | null;
}

export interface AlertCreatePayload {
  name: string;
  alert_type: AlertType;
  metric_id?: number | null;
  kpi_id?: number | null;
  standalone_config?: StandaloneConfig | null;
  condition: AlertCondition;
  schedule_cron: string;
  delivery_channels: AlertChannel[];
  slack_webhook_url?: string | null;
  message_template: string;
  recipients: RecipientIn[];
}

export interface AlertUpdatePayload {
  name?: string;
  // Source change — only the field matching the alert's existing alert_type is
  // honored; alert_type itself is immutable. Switching alert types requires
  // delete + recreate.
  metric_id?: number | null;
  kpi_id?: number | null;
  standalone_config?: StandaloneConfig | null;
  condition?: AlertCondition;
  schedule_cron?: string;
  delivery_channels?: AlertChannel[];
  slack_webhook_url?: string | null;
  message_template?: string;
  recipients?: RecipientIn[];
  is_active?: boolean;
}

export interface AlertResponse {
  id: number;
  name: string;
  alert_type: AlertType;
  metric_id: number | null;
  metric_name: string | null;
  kpi_id: number | null;
  kpi_name: string | null;
  standalone_config: StandaloneConfig | null;
  condition: AlertCondition;
  schedule_cron: string;
  delivery_channels: AlertChannel[];
  slack_webhook_url_masked: string | null;
  message_template: string;
  is_active: boolean;
  last_evaluated_at: string | null;
  recipients: RecipientOut[];
  created_at: string;
  updated_at: string;
}

/** Mirrors `KpiRagContext` in alert_schema.py — drives RAG-chip tooltip math. */
export interface KpiRagContext {
  target_value: number | null;
  direction: 'increase' | 'decrease';
  green_threshold_pct: number;
  amber_threshold_pct: number;
}

export interface AlertListItem {
  id: number;
  name: string;
  alert_type: AlertType;
  source_kind: 'metric' | 'kpi' | 'dataset';
  source_id: number | null;
  source_name: string | null;
  condition_pretty: string;
  rag_states: RagState[] | null;
  kpi_rag_context: KpiRagContext | null;
  schedule_frequency: string;
  schedule_cron: string;
  is_active: boolean;
  last_fire_at: string | null;
  fire_streak: number;
}

export interface AlertListResponse {
  data: AlertListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AlertLogDelivery {
  channel: AlertChannel;
  target: string;
  status: 'sent' | 'failed';
  error_reason?: string | null;
  http_status?: number | null;
  sent_at: string;
}

export interface AlertLog {
  id: number;
  scheduled_for: string;
  evaluated_at: string;
  value: number | null;
  fired: boolean;
  rag_status: RagState | null;
  condition_pretty: string;
  sql_executed: string;
  message: string;
  deliveries: AlertLogDelivery[];
}

export interface AlertLogListResponse {
  data: AlertLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface SlackWebhookTestResponse {
  success: boolean;
  http_status: number;
  response_body: string;
}

export interface AlertTestPayload {
  name?: string;
  alert_type: AlertType;
  metric_id?: number | null;
  kpi_id?: number | null;
  standalone_config?: StandaloneConfig | null;
  condition: AlertCondition;
  delivery_channels: AlertChannel[];
  message_template: string;
}

export interface AlertTestResponse {
  would_fire: boolean;
  current_value: number | null;
  sql_executed: string;
  message: string;
  error: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────

export const ALERT_PERMISSIONS = {
  view: 'can_view_alerts',
  create: 'can_create_alerts',
  edit: 'can_edit_alerts',
  delete: 'can_delete_alerts',
} as const;

export const THRESHOLD_OPERATOR_OPTIONS = [
  { value: 'lt' as const, label: 'less than' },
  { value: 'gt' as const, label: 'greater than' },
  { value: 'eq' as const, label: 'equal to' },
];

export const RAG_STATE_OPTIONS = [
  { value: 'red' as const, label: 'Red' },
  { value: 'amber' as const, label: 'Amber' },
  { value: 'green' as const, label: 'Green' },
];

export const FREQUENCY_OPTIONS = [
  { value: 'daily' as const, label: 'Daily' },
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
];

export type FrequencyType = (typeof FREQUENCY_OPTIONS)[number]['value'];

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const TOKENS_BY_TYPE: Record<AlertType, string[]> = {
  [AlertType.METRIC_THRESHOLD]: ['alert_name', 'metric_name', 'target_value', 'current_value'],
  [AlertType.KPI_RAG]: ['alert_name', 'kpi_name', 'target_value', 'current_value', 'rag_status'],
  [AlertType.STANDALONE]: ['alert_name', 'dataset_name', 'target_value', 'current_value'],
};

// ── Schedule ↔ Cron utilities ─────────────────────────────────────────────

export interface ScheduleSpec {
  frequency: FrequencyType;
  hour: number; // local-clock 0-23
  minute: number; // local-clock 0-59
  dayOfWeek?: number; // 0-6 (Sun-Sat) — weekly only
  dayOfMonth?: number; // 1-28 — monthly only
}

/**
 * Convert a local-clock schedule spec to a 5-field UTC cron expression.
 *
 * Browser local time is converted to UTC for storage. For weekly schedules
 * we shift the day-of-week when the time crosses UTC midnight in either
 * direction. (Monthly we accept the rare edge of a UTC day-shift crossing
 * the end of month — for v1 we cap day-of-month at 28 in the UI so this is
 * not a concern.)
 */
export function localScheduleToUtcCron(spec: ScheduleSpec): string {
  const today = new Date();
  const local = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    spec.hour,
    spec.minute,
    0,
    0
  );
  const utcMinute = local.getUTCMinutes();
  const utcHour = local.getUTCHours();
  // dayShift = how many calendar days UTC is ahead of local for this instant
  // (-1, 0, or +1). Compare midnight timestamps so month boundaries (1 vs 31)
  // don't fool a naive numeric `>` on day-of-month.
  const localMid = Date.UTC(local.getFullYear(), local.getMonth(), local.getDate());
  const utcMid = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const dayShift = localMid === utcMid ? 0 : utcMid > localMid ? 1 : -1;

  if (spec.frequency === 'daily') {
    return `${utcMinute} ${utcHour} * * *`;
  }
  if (spec.frequency === 'weekly') {
    const dow = ((spec.dayOfWeek ?? 1) + dayShift + 7) % 7;
    return `${utcMinute} ${utcHour} * * ${dow}`;
  }
  // monthly — dayOfMonth is in local-time; if UTC shifts the day we apply it
  // and clamp to [1, 28] (UI also enforces this).
  let dom = (spec.dayOfMonth ?? 1) + dayShift;
  if (dom < 1) dom = 1;
  if (dom > 28) dom = 28;
  return `${utcMinute} ${utcHour} ${dom} * *`;
}

/**
 * Parse a 5-field cron expression back into a local-clock schedule spec.
 * Returns null if the cron pattern is not one of our wizard-produced shapes.
 */
export function utcCronToLocalSchedule(cron: string): ScheduleSpec | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minStr, hourStr, domStr, monthStr, dowStr] = parts;
  const minute = parseInt(minStr, 10);
  const hour = parseInt(hourStr, 10);
  if (Number.isNaN(minute) || Number.isNaN(hour)) return null;
  if (monthStr !== '*') return null;

  // Build a "today at UTC hour:minute" date, then read off local fields.
  const today = new Date();
  const utc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hour, minute)
  );
  const localHour = utc.getHours();
  const localMinute = utc.getMinutes();
  // dayShift = how many calendar days local is ahead of UTC for this instant
  // (-1, 0, or +1). Compare midnight timestamps so month boundaries (1 vs 31)
  // don't fool a naive numeric `>` on day-of-month.
  const localMid = Date.UTC(utc.getFullYear(), utc.getMonth(), utc.getDate());
  const utcMid = Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  const dayShift = localMid === utcMid ? 0 : localMid > utcMid ? 1 : -1;

  if (domStr === '*' && dowStr === '*') {
    return { frequency: 'daily', hour: localHour, minute: localMinute };
  }
  if (domStr === '*' && /^\d+$/.test(dowStr)) {
    const dow = (parseInt(dowStr, 10) + dayShift + 7) % 7;
    return { frequency: 'weekly', hour: localHour, minute: localMinute, dayOfWeek: dow };
  }
  if (/^\d+$/.test(domStr) && dowStr === '*') {
    let dom = parseInt(domStr, 10) + dayShift;
    if (dom < 1) dom = 1;
    if (dom > 28) dom = 28;
    return { frequency: 'monthly', hour: localHour, minute: localMinute, dayOfMonth: dom };
  }
  return null;
}
