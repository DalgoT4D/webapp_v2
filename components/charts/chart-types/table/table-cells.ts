import { formatNumber, formatDate } from '@/lib/formatters';
import type { ConditionalFormattingRule } from '@/components/charts/styling/conditional-formatting';

// URL detection pattern - matches http://, https://, and www. prefixed URLs
const URL_PATTERN = /^(https?:\/\/|www\.)/i;

/** Is the cell a URL that should render as a link? */
export function isValidUrl(value: unknown): boolean {
  if (value == null || typeof value !== 'string') return false;
  return URL_PATTERN.test(value.trim());
}

/** href for a URL cell: www. gets an https:// prefix. */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.toLowerCase().startsWith('www.')) return `https://${trimmed}`;
  return trimmed;
}

/** Per-column formatting as stored in the table's column_formatting. */
export interface TableColumnFormatting {
  type?: 'currency' | 'percentage' | 'date' | 'number' | 'text';
  numberFormat?: string;
  dateFormat?: string;
  decimalPlaces?: number;
  /** Old name of decimalPlaces, still read for saved charts. */
  precision?: number;
  prefix?: string;
  suffix?: string;
}

function formatByType(
  value: any,
  formatting: TableColumnFormatting,
  decimalPlaces?: number
): string {
  const { type, prefix = '', suffix = '' } = formatting;
  switch (type) {
    case 'currency':
      if (typeof value !== 'number') return value?.toString() || '';
      return `${prefix}$${value.toFixed(decimalPlaces ?? 2)}${suffix}`;
    case 'percentage':
      if (typeof value !== 'number') return value?.toString() || '';
      return `${prefix}${(value * 100).toFixed(decimalPlaces ?? 2)}%${suffix}`;
    case 'number':
      if (typeof value !== 'number') return value?.toString() || '';
      return `${prefix}${value.toFixed(decimalPlaces ?? 0)}${suffix}`;
    case 'date':
      try {
        return `${prefix}${new Date(value).toLocaleDateString()}${suffix}`;
      } catch {
        return value?.toString() || '';
      }
    case 'text':
    default:
      return `${prefix}${value?.toString() || ''}${suffix}`;
  }
}

/** Display text for a table cell. Moved verbatim from TableChart's inline formatCellValue. */
export function formatTableCell(value: any, formatting: TableColumnFormatting | undefined): string {
  if (!formatting || value == null) return value?.toString() || '';

  const { type, numberFormat, dateFormat, prefix = '', suffix = '' } = formatting;
  const decimalPlaces = formatting.decimalPlaces ?? formatting.precision;

  if (dateFormat && dateFormat !== 'default') {
    try {
      return `${prefix}${formatDate(value, { format: dateFormat as any })}${suffix}`;
    } catch {
      return value?.toString() || '';
    }
  }
  if (numberFormat || (decimalPlaces !== undefined && !type)) {
    const numericValue = Number(value);
    if (isNaN(numericValue)) return value?.toString() || '';
    const formatted = formatNumber(numericValue, {
      format: (numberFormat || 'default') as any,
      decimalPlaces,
    });
    return `${prefix}${formatted}${suffix}`;
  }
  return formatByType(value, formatting, decimalPlaces);
}

function matchesNumericRule(operator: string, cell: number, ruleValue: number): boolean {
  switch (operator) {
    case '>':
      return cell > ruleValue;
    case '<':
      return cell < ruleValue;
    case '>=':
      return cell >= ruleValue;
    case '<=':
      return cell <= ruleValue;
    case '==':
      return cell === ruleValue;
    case '!=':
      return cell !== ruleValue;
    default:
      return false;
  }
}

/**
 * Background color from conditional formatting — last matching rule wins. Rules scoped to another
 * drill level are skipped; rules saved without a `type` are numeric.
 */
export function getConditionalCellColor(
  rules: ConditionalFormattingRule[] | undefined,
  value: unknown,
  column: string,
  currentDimensionColumn: string | undefined
): string | undefined {
  if (!rules || rules.length === 0) return undefined;
  let matchedColor: string | undefined;
  for (const rule of rules) {
    if (rule.column !== column) continue;
    if (rule.level !== undefined && rule.level !== currentDimensionColumn) continue;

    const ruleType = (rule as { type?: 'numeric' | 'text' }).type ?? 'numeric';
    let matches: boolean;
    if (ruleType === 'text') {
      const cellStr = String(value ?? '');
      const ruleStr = String(rule.value);
      matches = rule.operator === '==' ? cellStr === ruleStr : cellStr !== ruleStr;
    } else {
      const numValue = Number(value);
      if (isNaN(numValue)) continue;
      matches = matchesNumericRule(rule.operator, numValue, rule.value as number);
    }
    if (matches) matchedColor = rule.color;
  }
  return matchedColor;
}

const ALIGNMENT_CLASSES: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/**
 * Text alignment for a column: the user's choice, else first column left / last column right,
 * else numbers right and text left.
 */
export function getAlignmentClass(
  explicitAlignment: string | undefined,
  columns: string[],
  column: string,
  sampleValue: unknown
): string {
  if (explicitAlignment && ALIGNMENT_CLASSES[explicitAlignment])
    return ALIGNMENT_CLASSES[explicitAlignment];
  if (columns.length > 1) {
    const colIdx = columns.indexOf(column);
    if (colIdx === 0) return 'text-left';
    if (colIdx === columns.length - 1) return 'text-right';
  }
  if (sampleValue != null) {
    const isNumeric = typeof sampleValue === 'number' || !isNaN(Number(sampleValue));
    return isNumeric ? 'text-right' : 'text-left';
  }
  return 'text-left';
}
