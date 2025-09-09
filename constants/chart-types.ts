export const CHART_TYPE_COLORS = {
  bar: {
    color: '#3B82F6',
    bgColor: '#3B82F61A',
    className: 'text-[#3B82F6]',
    bgClassName: 'bg-[#3B82F6]/10',
  },
  pie: {
    color: '#F97316',
    bgColor: '#F973161A',
    className: 'text-[#F97316]',
    bgClassName: 'bg-[#F97316]/10',
  },
  line: {
    color: '#10B981',
    bgColor: '#10B9811A',
    className: 'text-[#10B981]',
    bgClassName: 'bg-[#10B981]/10',
  },
  number: {
    color: '#8B5CF6',
    bgColor: '#8B5CF61A',
    className: 'text-[#8B5CF6]',
    bgClassName: 'bg-[#8B5CF6]/10',
  },
  map: {
    color: '#EF4444',
    bgColor: '#EF44441A',
    className: 'text-[#EF4444]',
    bgClassName: 'bg-[#EF4444]/10',
  },
  table: {
    color: '#6B7280',
    bgColor: '#6B72801A',
    className: 'text-[#6B7280]',
    bgClassName: 'bg-[#6B7280]/10',
  },
} as const;

export type ChartType = keyof typeof CHART_TYPE_COLORS;

export function getChartTypeColor(type: ChartType) {
  return CHART_TYPE_COLORS[type] || CHART_TYPE_COLORS.bar;
}
