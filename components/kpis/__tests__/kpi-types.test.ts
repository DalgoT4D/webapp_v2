/**
 * Tests for KPI types and constants
 */

import {
  RAG_COLORS,
  DIRECTION_OPTIONS,
  METRIC_TYPE_TAG_OPTIONS,
  TIME_GRAIN_OPTIONS,
} from '@/types/kpis';
import type { RAGStatus } from '@/types/kpis';

describe('RAG_COLORS', () => {
  it('has all three statuses', () => {
    expect(RAG_COLORS).toHaveProperty('green');
    expect(RAG_COLORS).toHaveProperty('amber');
    expect(RAG_COLORS).toHaveProperty('red');
  });

  it('uses correct Figma v2 labels', () => {
    expect(RAG_COLORS.green.label).toBe('On Track');
    expect(RAG_COLORS.amber.label).toBe('Needs Attention');
    expect(RAG_COLORS.red.label).toBe('Off Track');
  });

  it('has dot color for each status', () => {
    expect(RAG_COLORS.green.dot).toContain('bg-green');
    expect(RAG_COLORS.amber.dot).toContain('bg-amber');
    expect(RAG_COLORS.red.dot).toContain('bg-red');
  });

  it('has bg and text classes for each status', () => {
    const statuses: RAGStatus[] = ['green', 'amber', 'red'];
    statuses.forEach((status) => {
      expect(RAG_COLORS[status].bg).toBeTruthy();
      expect(RAG_COLORS[status].text).toBeTruthy();
    });
  });
});

describe('DIRECTION_OPTIONS', () => {
  it('has increase and decrease', () => {
    expect(DIRECTION_OPTIONS).toHaveLength(2);
    expect(DIRECTION_OPTIONS[0].value).toBe('increase');
    expect(DIRECTION_OPTIONS[1].value).toBe('decrease');
  });

  it('uses plain-language labels', () => {
    expect(DIRECTION_OPTIONS[0].label).toBe('Higher is better');
    expect(DIRECTION_OPTIONS[1].label).toBe('Lower is better');
  });
});

describe('METRIC_TYPE_TAG_OPTIONS', () => {
  it('has all four logframe types', () => {
    const values = METRIC_TYPE_TAG_OPTIONS.map((o) => o.value);
    expect(values).toEqual(['input', 'output', 'outcome', 'impact']);
  });
});

describe('TIME_GRAIN_OPTIONS', () => {
  it('has standard time grains', () => {
    const values = TIME_GRAIN_OPTIONS.map((o) => o.value);
    expect(values).toContain('daily');
    expect(values).toContain('monthly');
    expect(values).toContain('quarterly');
    expect(values).toContain('yearly');
  });
});
