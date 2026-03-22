/**
 * YAML parser for the metrics configuration.
 */
import yaml from 'js-yaml';
import type { Metric, ParsedMetricsData, RagStatus } from './types';

function computeRagStatus(
  current: number,
  target: number,
  direction: 'higher-is-better' | 'lower-is-better'
): RagStatus {
  if (direction === 'higher-is-better') {
    if (current >= target) return 'on_track';
    if (current < target * 0.8) return 'below_target';
    return 'at_risk';
  }
  if (current <= target) return 'on_track';
  if (current > target * 1.2) return 'below_target';
  return 'at_risk';
}

function parseMetricFromRaw(raw: Record<string, unknown>): Metric {
  const id = Number(raw.id) || 0;
  const name = String(raw.name || '').trim();
  const category = String(raw.category || 'Other').trim();
  const unit = String(raw.unit ?? '').trim();
  const direction = raw.direction === 'lower-is-better' ? 'lower-is-better' : 'higher-is-better';
  const baseline = Number(raw.baseline) || 0;
  const target = Number(raw.target) || 0;
  const current = Number(raw.current) ?? baseline;
  const trend = Array.isArray(raw.trend)
    ? (raw.trend as unknown[]).map((v) => Number(v) || 0)
    : [baseline, current];
  const trend_labels = Array.isArray(raw.trend_labels)
    ? (raw.trend_labels as unknown[]).map((v) => String(v || ''))
    : trend.map((_, i) => (i === 0 ? 'Start' : 'Now'));
  const annotation =
    raw.annotation === null || raw.annotation === undefined || raw.annotation === 'null'
      ? null
      : String(raw.annotation || '').trim() || null;
  const evidenceRaw = raw.evidence;
  const evidence =
    evidenceRaw && typeof evidenceRaw === 'object' && !Array.isArray(evidenceRaw)
      ? {
          quote: String((evidenceRaw as Record<string, unknown>).quote || '').trim(),
          source: String((evidenceRaw as Record<string, unknown>).source || '').trim(),
        }
      : null;

  const ragStatus = computeRagStatus(current, target, direction);

  return {
    id,
    name,
    category,
    unit,
    direction,
    baseline,
    target,
    current,
    trend,
    trend_labels,
    annotation,
    evidence: evidence?.quote || evidence?.source ? evidence : null,
    ragStatus,
  };
}

export function parseMetricsYaml(yamlStr: string): {
  success: boolean;
  data?: ParsedMetricsData;
  error?: string;
} {
  if (!yamlStr.trim()) {
    return { success: false, error: 'Configuration is empty' };
  }

  try {
    const parsed = yaml.load(yamlStr) as Record<string, unknown>;

    if (!parsed?.metrics || !Array.isArray(parsed.metrics)) {
      return { success: false, error: 'No valid metrics found' };
    }

    const programme = (parsed.programme as Record<string, string>) || {};
    const metrics: Metric[] = [];
    for (const m of parsed.metrics as Record<string, unknown>[]) {
      if (m?.id != null) {
        metrics.push(parseMetricFromRaw(m));
      }
    }

    if (metrics.length === 0) {
      return { success: false, error: 'No valid metrics found' };
    }

    return {
      success: true,
      data: {
        programme: {
          name: programme.name || 'Care Companion Program',
          organisation: programme.organisation || 'Noora Health',
          period: programme.period || 'Q4 FY26',
          last_updated: programme.last_updated || '2026-03-23',
        },
        metrics,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to parse configuration',
    };
  }
}
