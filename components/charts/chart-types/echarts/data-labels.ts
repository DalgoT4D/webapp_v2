/**
 * Chart Data Label Rules
 *
 * Allowed `dataLabelPosition` values per chart type, and sanitization of
 * customizations carried over across a chart-type switch.
 * Split out of formatting.ts — see that file for the shared number formatting.
 */

/**
 * Allowed `dataLabelPosition` values per chart type — MUST match the backend
 * `*ChartCustomizations` Literal constraints (ddpui/schemas/chart_schemas/customizations.py).
 * Types not listed here (number/table/map) have no `dataLabelPosition` field.
 */
export const DATA_LABEL_POSITIONS: Record<string, readonly string[]> = {
  bar: ['top', 'inside', 'insideBottom'],
  line: ['top', 'bottom', 'left', 'right'],
  pie: ['outside', 'inside'],
};

export const DEFAULT_DATA_LABEL_POSITION: Record<string, string> = {
  bar: 'top',
  line: 'top',
  pie: 'outside',
};

/**
 * When the chart type changes, a `dataLabelPosition` carried over from the previous type may be
 * invalid for the new type's schema (e.g. bar's 'top' fails pie which only allows 'outside'|'inside').
 * Coerce it to a valid value for the new type, or drop it for types without the field.
 */
export function sanitizeCustomizationsForChartType<T extends Record<string, any>>(
  customizations: T | undefined,
  chartType: string
): T {
  const result = { ...(customizations || {}) } as T;
  if (!('dataLabelPosition' in result)) return result;

  const allowed = DATA_LABEL_POSITIONS[chartType];
  if (!allowed) {
    // New chart type has no dataLabelPosition field — drop it to avoid validation errors.
    delete (result as Record<string, any>).dataLabelPosition;
    return result;
  }
  if (!allowed.includes((result as Record<string, any>).dataLabelPosition)) {
    (result as Record<string, any>).dataLabelPosition = DEFAULT_DATA_LABEL_POSITION[chartType];
  }
  return result;
}
