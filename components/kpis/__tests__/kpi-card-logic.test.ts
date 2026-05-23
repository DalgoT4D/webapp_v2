/**
 * Tests for KPI card computation logic
 * (period-over-period change, direction-aware coloring)
 */

import { computePopChanges } from '@/lib/formatters';

function computePopChange(periods: { value: number | null }[]): number | null {
  const values = periods.map((p) => p.value);
  return computePopChanges(values)[values.length - 1] ?? null;
}

function isChangePositive(popChange: number | null, direction: 'increase' | 'decrease'): boolean {
  if (popChange === null) return false;
  return (direction === 'increase' && popChange > 0) || (direction === 'decrease' && popChange < 0);
}

function isChangeNegative(popChange: number | null, direction: 'increase' | 'decrease'): boolean {
  if (popChange === null) return false;
  return (direction === 'increase' && popChange < 0) || (direction === 'decrease' && popChange > 0);
}

describe('Period-over-period change computation', () => {
  it('returns null for empty periods', () => {
    expect(computePopChange([])).toBeNull();
  });

  it('returns null for single period', () => {
    expect(computePopChange([{ value: 100 }])).toBeNull();
  });

  it('computes positive change', () => {
    const result = computePopChange([{ value: 100 }, { value: 120 }]);
    expect(result).toBe(20);
  });

  it('computes negative change', () => {
    const result = computePopChange([{ value: 100 }, { value: 80 }]);
    expect(result).toBe(-20);
  });

  it('returns null when previous is zero', () => {
    expect(computePopChange([{ value: 0 }, { value: 100 }])).toBeNull();
  });

  it('returns null when current is null', () => {
    expect(computePopChange([{ value: 100 }, { value: null }])).toBeNull();
  });

  it('returns null when previous is null', () => {
    expect(computePopChange([{ value: null }, { value: 100 }])).toBeNull();
  });

  it('uses last two periods only', () => {
    const result = computePopChange([{ value: 50 }, { value: 100 }, { value: 120 }]);
    // (120 - 100) / 100 * 100 = 20%
    expect(result).toBe(20);
  });

  it('handles large negative change', () => {
    const result = computePopChange([{ value: 1000 }, { value: 100 }]);
    expect(result).toBe(-90);
  });
});

describe('Direction-aware change classification', () => {
  describe('increase direction (higher is better)', () => {
    it('+20% is positive (good)', () => {
      expect(isChangePositive(20, 'increase')).toBe(true);
      expect(isChangeNegative(20, 'increase')).toBe(false);
    });

    it('-20% is negative (bad)', () => {
      expect(isChangePositive(-20, 'increase')).toBe(false);
      expect(isChangeNegative(-20, 'increase')).toBe(true);
    });

    it('0% is neither positive nor negative', () => {
      expect(isChangePositive(0, 'increase')).toBe(false);
      expect(isChangeNegative(0, 'increase')).toBe(false);
    });
  });

  describe('decrease direction (lower is better)', () => {
    it('-20% is positive (good — number went down)', () => {
      expect(isChangePositive(-20, 'decrease')).toBe(true);
      expect(isChangeNegative(-20, 'decrease')).toBe(false);
    });

    it('+20% is negative (bad — number went up)', () => {
      expect(isChangePositive(20, 'decrease')).toBe(false);
      expect(isChangeNegative(20, 'decrease')).toBe(true);
    });
  });

  it('null change is neither', () => {
    expect(isChangePositive(null, 'increase')).toBe(false);
    expect(isChangeNegative(null, 'increase')).toBe(false);
  });
});
