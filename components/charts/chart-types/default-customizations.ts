import { ChartTypes } from '@/types/charts';

/** Which chart builder page is asking. The two pages differ in a few pinned ways. */
export type ChartBuilderKind = 'create' | 'edit';

type Customizations = Record<string, unknown>;

/** Styling a new chart starts with, as the create page sets it. */
const CREATE_DEFAULTS: Record<string, Customizations> = {
  [ChartTypes.BAR]: {
    orientation: 'vertical',
    showDataLabels: false,
    dataLabelPosition: 'top',
    stacked: false,
    showTooltip: true,
    showLegend: true,
    xAxisTitle: '',
    yAxisTitle: '',
    // Bar categories are usually long text labels — 45° keeps them readable without truncation
    xAxisLabelRotation: '45',
    yAxisLabelRotation: 'horizontal',
  },
  [ChartTypes.PIE]: {
    chartStyle: 'donut',
    labelFormat: 'percentage',
    showDataLabels: true,
    dataLabelPosition: 'outside',
    showTooltip: true,
    showLegend: true,
    legendPosition: 'right',
  },
  [ChartTypes.LINE]: {
    lineStyle: 'smooth',
    showDataPoints: true,
    showTooltip: true,
    showLegend: true,
    showDataLabels: false,
    dataLabelPosition: 'top',
    xAxisTitle: '',
    yAxisTitle: '',
    xAxisLabelRotation: 'horizontal',
    yAxisLabelRotation: 'horizontal',
  },
  [ChartTypes.NUMBER]: {
    numberSize: 'medium',
    subtitle: '',
    numberFormat: 'default',
    decimalPlaces: 0, // PINNED-BUGS: ratio 0.503 renders "1"
    numberPrefix: '',
    numberSuffix: '',
  },
  [ChartTypes.MAP]: {
    colorScheme: 'Blues',
    showTooltip: true,
    showLegend: true,
    nullValueLabel: 'No Data',
    title: '',
  },
  [ChartTypes.PIVOT_TABLE]: {
    numberFormat: 'default',
    decimalPlaces: 0,
  },
};

/** What the edit page adds on top. PINNED-BUGS: "Create vs edit builders differ … legend defaults" (C-E7). */
const EDIT_PAGE_ADDITIONS: Record<string, Customizations> = {
  [ChartTypes.BAR]: { legendDisplay: 'paginated', legendPosition: 'top' },
  [ChartTypes.PIE]: { legendDisplay: 'paginated', legendPosition: 'top' },
  [ChartTypes.LINE]: { legendDisplay: 'paginated', legendPosition: 'top' },
  [ChartTypes.MAP]: { showLabels: false },
};

/** Default styling for a chart type. Returns a new object every call. */
export function getDefaultCustomizations(
  chartType: string,
  builder: ChartBuilderKind
): Customizations {
  const createDefaults = CREATE_DEFAULTS[chartType] ?? {};
  if (builder === 'create') return { ...createDefaults };
  return { ...createDefaults, ...(EDIT_PAGE_ADDITIONS[chartType] ?? {}) };
}
