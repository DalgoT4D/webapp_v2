import { formatNumber, NumberFormats, type NumberFormat } from '@/lib/formatters';
import type { ConditionalFormattingRule } from '@/components/charts/styling/conditional-formatting';

/** Per-metric formatting from the pivot's customizations.columnFormatting. */
export interface PivotColumnFormat {
  numberFormat?: NumberFormat;
  decimalPlaces?: number;
}

/**
 * colspan spans for nested column headers. For header level `level`, counts how many consecutive
 * column_keys share the same value at indices 0..level.
 */
export function computeHeaderSpans(
  columnKeys: string[][],
  level: number
): { value: string; span: number; startIdx: number }[] {
  const spans: { value: string; span: number; startIdx: number }[] = [];
  let i = 0;
  while (i < columnKeys.length) {
    const currentKey = columnKeys[i];
    let count = 1;
    for (let j = i + 1; j < columnKeys.length; j++) {
      let match = true;
      for (let l = 0; l <= level; l++) {
        if (columnKeys[j][l] !== currentKey[l]) {
          match = false;
          break;
        }
      }
      if (!match) break;
      count++;
    }
    spans.push({ value: currentKey[level], span: count, startIdx: i });
    i += count;
  }
  return spans;
}

/**
 * Display text for a pivot value cell. PINNED-BUGS: "Pivot shows calculated ratios with 0 decimals
 * by default (0.49 → "0")" — no format means 0 decimals.
 */
export function formatPivotCell(
  value: number | null,
  format: PivotColumnFormat | undefined
): string {
  if (value === null || value === undefined) return 'N/A';
  if (format?.numberFormat && format.numberFormat !== NumberFormats.DEFAULT) {
    return formatNumber(Number(value), {
      format: format.numberFormat,
      decimalPlaces: format.decimalPlaces,
    });
  }
  const decimals = typeof format?.decimalPlaces === 'number' ? format.decimalPlaces : 0;
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Background color for a pivot value cell — numeric rules only, last match wins. */
export function getPivotConditionalColor(
  rules: ConditionalFormattingRule[],
  value: number | null,
  metricName: string
): string | undefined {
  if (!rules.length || value === null || value === undefined) return undefined;
  const numValue = Number(value);
  if (isNaN(numValue)) return undefined;

  let matchedColor: string | undefined;
  for (const rule of rules) {
    if (rule.column !== metricName) continue;
    let matches = false;
    switch (rule.operator) {
      case '>':
        matches = numValue > (rule.value as number);
        break;
      case '<':
        matches = numValue < (rule.value as number);
        break;
      case '>=':
        matches = numValue >= (rule.value as number);
        break;
      case '<=':
        matches = numValue <= (rule.value as number);
        break;
      case '==':
        matches = numValue === rule.value;
        break;
      case '!=':
        matches = numValue !== rule.value;
        break;
    }
    if (matches) matchedColor = rule.color;
  }
  return matchedColor;
}
