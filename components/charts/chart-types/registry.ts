import {
  BarChart2,
  Grid3X3,
  Hash,
  LineChart,
  MapPin,
  PieChart,
  Table,
  type LucideIcon,
} from 'lucide-react';
import { ChartTypes, type ChartType } from '@/types/charts';

/**
 * Everything the UI needs to *show* a chart type — one row per type.
 * Data only: behavior lives in components/charts/logic/*.
 */

export interface ChartTypeColors {
  color: string;
  bgColor: string;
  className: string;
  bgClassName: string;
}

export interface ChartTypeInfo {
  icon: LucideIcon;
  /** Icon in the /charts list. PINNED-BUGS: pivot shows the bar icon (the list had no pivot entry). */
  listIcon: LucideIcon;
  colors: ChartTypeColors;
  /** The builder's chart-type switcher (tooltip + description line). */
  selector: { label: string; description: string };
  /** The step-1 cards on /charts/new. */
  newChartCard: { label: string; description: string; textClassName: string; bgClassName: string };
}

export const CHART_TYPE_INFO: Record<ChartType, ChartTypeInfo> = {
  [ChartTypes.BAR]: {
    icon: BarChart2,
    listIcon: BarChart2,
    colors: {
      color: '#3B82F6',
      bgColor: '#3B82F61A',
      className: 'text-[#3B82F6]',
      bgClassName: 'bg-[#3B82F6]/10',
    },
    selector: { label: 'Bar Chart', description: 'Compare values across categories' },
    newChartCard: {
      label: 'Bar Chart',
      description: 'Compare values across categories',
      textClassName: 'text-blue-600',
      bgClassName: 'bg-blue-50',
    },
  },
  [ChartTypes.LINE]: {
    icon: LineChart,
    listIcon: LineChart,
    colors: {
      color: '#10B981',
      bgColor: '#10B9811A',
      className: 'text-[#10B981]',
      bgClassName: 'bg-[#10B981]/10',
    },
    selector: { label: 'Line Chart', description: 'Display trends over time' },
    newChartCard: {
      label: 'Line Chart',
      description: 'Display trends over time',
      textClassName: 'text-green-600',
      bgClassName: 'bg-green-50',
    },
  },
  [ChartTypes.PIE]: {
    icon: PieChart,
    listIcon: PieChart,
    colors: {
      color: '#F97316',
      bgColor: '#F973161A',
      className: 'text-[#F97316]',
      bgClassName: 'bg-[#F97316]/10',
    },
    selector: { label: 'Pie Chart', description: 'Show proportions of a whole' },
    newChartCard: {
      label: 'Pie Chart',
      description: 'Show proportions of a whole',
      textClassName: 'text-orange-600',
      bgClassName: 'bg-orange-50',
    },
  },
  [ChartTypes.NUMBER]: {
    icon: Hash,
    listIcon: Hash,
    colors: {
      color: '#8B5CF6',
      bgColor: '#8B5CF61A',
      className: 'text-[#8B5CF6]',
      bgClassName: 'bg-[#8B5CF6]/10',
    },
    // BUILDER-DRIFT: switcher and /charts/new intentionally use different copy today
    // ("Big Number" vs "Number", different descriptions).
    selector: { label: 'Big Number', description: 'Display a single key metric prominently' },
    newChartCard: {
      label: 'Number',
      description: 'Display key metrics and KPIs',
      textClassName: 'text-purple-600',
      bgClassName: 'bg-purple-50',
    },
  },
  [ChartTypes.MAP]: {
    icon: MapPin,
    listIcon: MapPin,
    colors: {
      color: '#EF4444',
      bgColor: '#EF44441A',
      className: 'text-[#EF4444]',
      bgClassName: 'bg-[#EF4444]/10',
    },
    selector: { label: 'Map', description: 'Visualize geographic data' },
    newChartCard: {
      label: 'Map',
      description: 'Visualize geographic data',
      textClassName: 'text-red-600',
      bgClassName: 'bg-red-50',
    },
  },
  [ChartTypes.TABLE]: {
    icon: Table,
    listIcon: Table,
    colors: {
      color: '#6B7280',
      bgColor: '#6B72801A',
      className: 'text-[#6B7280]',
      bgClassName: 'bg-[#6B7280]/10',
    },
    selector: { label: 'Table', description: 'Display data in rows and columns' },
    newChartCard: {
      label: 'Table',
      description: 'Display data in rows and columns',
      textClassName: 'text-slate-600',
      bgClassName: 'bg-slate-50',
    },
  },
  [ChartTypes.PIVOT_TABLE]: {
    icon: Grid3X3,
    listIcon: BarChart2, // PINNED-BUGS: "Pivot chart type shows the bar icon in the chart list"
    colors: {
      color: '#0EA5E9',
      bgColor: '#0EA5E91A',
      className: 'text-[#0EA5E9]',
      bgClassName: 'bg-[#0EA5E9]/10',
    },
    selector: { label: 'Pivot Table', description: 'Cross-tabulate data across two dimensions' },
    newChartCard: {
      label: 'Pivot Table',
      description: 'Cross-tabulate data across two dimensions',
      textClassName: 'text-sky-600',
      bgClassName: 'bg-sky-50',
    },
  },
};

/** Button order in the builder's chart-type switcher. */
export const BUILDER_SELECTOR_ORDER: ChartType[] = [
  ChartTypes.BAR,
  ChartTypes.LINE,
  ChartTypes.PIE,
  ChartTypes.NUMBER,
  ChartTypes.MAP,
  ChartTypes.TABLE,
  ChartTypes.PIVOT_TABLE,
];

/** Card order on /charts/new (pie before line, unlike the switcher). */
export const NEW_CHART_CARD_ORDER: ChartType[] = [
  ChartTypes.BAR,
  ChartTypes.PIE,
  ChartTypes.LINE,
  ChartTypes.NUMBER,
  ChartTypes.MAP,
  ChartTypes.TABLE,
  ChartTypes.PIVOT_TABLE,
];

function findChartTypeInfo(type: string): ChartTypeInfo | undefined {
  return CHART_TYPE_INFO[type as ChartType];
}

/** Colors for a chart type; unknown types use bar colors. */
export function getChartTypeColors(type: string): ChartTypeColors {
  return findChartTypeInfo(type)?.colors ?? CHART_TYPE_INFO[ChartTypes.BAR].colors;
}

/** Icon shown in the /charts list; unknown types use the bar icon. */
export function getChartListIcon(type: string): LucideIcon {
  return findChartTypeInfo(type)?.listIcon ?? BarChart2;
}
