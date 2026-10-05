import {
  formatTableCell,
  getAlignmentClass,
  getConditionalCellColor,
  isValidUrl,
  normalizeUrl,
} from '@/components/charts/chart-types/table/table-cells';
import type { ConditionalFormattingRule } from '@/components/charts/styling/conditional-formatting';

describe('URL cells', () => {
  it('detects http(s) and www. strings only', () => {
    expect(isValidUrl(' https://a.org ')).toBe(true);
    expect(isValidUrl('WWW.a.org')).toBe(true);
    expect(isValidUrl('ftp://a.org')).toBe(false);
    expect(isValidUrl(42)).toBe(false);
    expect(normalizeUrl(' www.a.org ')).toBe('https://www.a.org');
    expect(normalizeUrl('http://a.org')).toBe('http://a.org');
  });
});

describe('formatTableCell', () => {
  it('no formatting or null value → plain text', () => {
    expect(formatTableCell(12.5, undefined)).toBe('12.5');
    expect(formatTableCell(null, { type: 'number' })).toBe('');
  });

  it('typed formats only apply to real numbers', () => {
    expect(formatTableCell(1.5, { type: 'currency' })).toBe('$1.50');
    expect(formatTableCell(0.256, { type: 'percentage', decimalPlaces: 1 })).toBe('25.6%');
    expect(formatTableCell(3.7, { type: 'number', prefix: '~', suffix: ' kids' })).toBe('~4 kids');
    expect(formatTableCell('3.7', { type: 'number' })).toBe('3.7');
  });

  it('precision is the old name of decimalPlaces; decimals without a type use number formatting', () => {
    expect(formatTableCell(2, { type: 'currency', precision: 0 })).toBe('$2');
    expect(formatTableCell('1234.567', { decimalPlaces: 1 })).toBe('1234.6');
  });

  it('text type adds prefix and suffix', () => {
    expect(formatTableCell('KA', { type: 'text', prefix: '[', suffix: ']' })).toBe('[KA]');
  });
});

describe('getConditionalCellColor', () => {
  const rules = [
    { column: 'students', type: 'numeric', operator: '>', value: 10, color: '#aaa' },
    { column: 'students', type: 'numeric', operator: '>', value: 100, color: '#bbb' },
    { column: 'state', type: 'text', operator: '==', value: 'KA', color: '#ccc' },
    { column: 'district', operator: '<', value: 5, color: '#ddd', level: 'district' },
  ] as ConditionalFormattingRule[];

  it('last matching rule wins', () => {
    expect(getConditionalCellColor(rules, 50, 'students', undefined)).toBe('#aaa');
    expect(getConditionalCellColor(rules, 500, 'students', undefined)).toBe('#bbb');
    expect(getConditionalCellColor(rules, 'n/a', 'students', undefined)).toBeUndefined();
  });

  it('text rules compare strings; untyped rules are numeric; level-scoped rules need their level', () => {
    expect(getConditionalCellColor(rules, 'KA', 'state', undefined)).toBe('#ccc');
    expect(getConditionalCellColor(rules, 1, 'district', 'state')).toBeUndefined();
    expect(getConditionalCellColor(rules, 1, 'district', 'district')).toBe('#ddd');
    expect(getConditionalCellColor([], 1, 'district', undefined)).toBeUndefined();
  });
});

describe('getAlignmentClass', () => {
  const cols = ['state', 'students', 'total'];
  it('explicit alignment, then position, then type', () => {
    expect(getAlignmentClass('center', cols, 'state', 'KA')).toBe('text-center');
    expect(getAlignmentClass(undefined, cols, 'state', 5)).toBe('text-left');
    expect(getAlignmentClass(undefined, cols, 'total', 'x')).toBe('text-right');
    expect(getAlignmentClass(undefined, cols, 'students', '12')).toBe('text-right');
    expect(getAlignmentClass(undefined, cols, 'students', 'KA')).toBe('text-left');
    expect(getAlignmentClass(undefined, ['only'], 'only', null)).toBe('text-left');
  });
});
