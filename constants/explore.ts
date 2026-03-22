// constants/explore.ts

export const EXPLORE_COLORS = {
  PRIMARY_TEAL: '#00897b',
  TEAL_PALETTE: ['#00897b', '#33a195', '#66b8b0', '#98d0c9', '#cce7e4', '#c7d8d7'],
  STAT_BOX_BG: '#F5FAFA',
  LABEL_COLOR: 'rgba(15, 36, 64, 0.57)',
} as const;

export const EXPLORE_DIMENSIONS = {
  CHART_WIDTH: 700,
  CHART_HEIGHT: 100,
  TREE_ROW_HEIGHT: 30,
  TREE_INDENT: 8,
  SIDEBAR_MIN_WIDTH: 280,
  SIDEBAR_MAX_WIDTH: 550,
  SIDEBAR_DEFAULT_WIDTH: 280,
  STATISTICS_ROW_HEIGHT: 180,
  BAR_HEIGHT: 16,
} as const;

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 100] as const;

export const DEFAULT_PAGE_SIZE = 10;

export const POLLING_INTERVAL = 5000; // 5 seconds

export const POLLING_INITIAL_DELAY = 1000; // 1 second before first poll

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
