'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DEFAULT_METRICS_YAML } from './default-yaml';
import { parseMetricsYaml } from './yaml-parser';
import type { Metric, ParsedMetricsData } from './types';

interface MetricsContextValue {
  yaml: string;
  setYaml: (yaml: string) => void;
  parsedData: ParsedMetricsData | null;
  parseError: string | null;
  updateMetricAnnotation: (metricId: number, annotation: string) => void;
  applyYaml: () => void;
}

const MetricsContext = createContext<MetricsContextValue | null>(null);

const INITIAL_PARSE = parseMetricsYaml(DEFAULT_METRICS_YAML);
const INITIAL_DATA = INITIAL_PARSE.success ? INITIAL_PARSE.data! : null;

export function MetricsProvider({ children }: { children: React.ReactNode }) {
  const [yaml, setYamlState] = useState(DEFAULT_METRICS_YAML);
  const [parsedData, setParsedData] = useState<ParsedMetricsData | null>(INITIAL_DATA);
  const [parseError, setParseError] = useState<string | null>(
    INITIAL_PARSE.success ? null : INITIAL_PARSE.error || 'Parse failed'
  );

  const applyYaml = useCallback(() => {
    const result = parseMetricsYaml(yaml);
    if (result.success && result.data) {
      setParsedData(result.data);
      setParseError(null);
    } else {
      setParseError(result.error || 'Parse failed');
    }
  }, [yaml]);

  const setYaml = useCallback((newYaml: string) => {
    setYamlState(newYaml);
    const result = parseMetricsYaml(newYaml);
    if (result.success && result.data) {
      setParsedData(result.data);
      setParseError(null);
    } else {
      setParseError(result.error || 'Configuration has a syntax issue');
    }
  }, []);

  const updateMetricAnnotation = useCallback((metricId: number, annotation: string) => {
    setParsedData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        metrics: prev.metrics.map((m) =>
          m.id === metricId ? { ...m, annotation: annotation || null } : m
        ),
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      yaml,
      setYaml,
      parsedData,
      parseError,
      updateMetricAnnotation,
      applyYaml,
    }),
    [yaml, setYaml, parsedData, parseError, updateMetricAnnotation, applyYaml]
  );

  return <MetricsContext.Provider value={value}>{children}</MetricsContext.Provider>;
}

export function useMetrics() {
  const ctx = useContext(MetricsContext);
  if (!ctx) throw new Error('useMetrics must be used within MetricsProvider');
  return ctx;
}

export function useMetricsData(): ParsedMetricsData | null {
  const { parsedData } = useMetrics();
  return parsedData;
}

export function useMetric(id: number): Metric | null {
  const { parsedData } = useMetrics();
  return parsedData?.metrics.find((m) => m.id === id) ?? null;
}

export function useProgramme() {
  const { parsedData } = useMetrics();
  return parsedData?.programme ?? null;
}
