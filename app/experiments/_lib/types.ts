/**
 * Types for the metrics prototype.
 */
export type RagStatus = 'on_track' | 'at_risk' | 'below_target';

export interface MetricEvidence {
  quote: string;
  source: string;
}

export interface Metric {
  id: number;
  name: string;
  category: string;
  unit: string;
  direction: 'higher-is-better' | 'lower-is-better';
  baseline: number;
  target: number;
  current: number;
  trend: number[];
  trend_labels: string[];
  annotation: string | null;
  evidence: MetricEvidence | null;
  // Computed, not from YAML
  ragStatus: RagStatus;
}

export interface ProgrammeInfo {
  name: string;
  organisation: string;
  period: string;
  last_updated: string;
}

export interface ParsedMetricsData {
  programme: ProgrammeInfo;
  metrics: Metric[];
}
