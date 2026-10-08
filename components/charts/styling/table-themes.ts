/** Predefined color theme for table and pivot table charts */
export interface TableTheme {
  id: string;
  label: string;
  header: string;
  headerText: string;
  row: string;
  zebraRow: string;
  border: string;
  subtotalRow: string;
  grandTotalRow: string;
  /** Darker border used inside grand-total cells so gridlines stay visible against grandTotalRow */
  grandTotalBorder: string;
  hoverRow: string;
}

/** Default theme id used when no theme is specified */
export const DEFAULT_THEME_ID = 'gray';

/** Predefined color themes for table and pivot table charts */
export const TABLE_THEMES: TableTheme[] = [
  {
    id: 'gray',
    label: 'Gray',
    header: '#F3F4F6',
    headerText: '#111827',
    row: '#FFFFFF',
    zebraRow: '#F9FAFB',
    border: '#D1D5DB',
    subtotalRow: '#E5E7EB',
    grandTotalRow: '#D1D5DB',
    grandTotalBorder: '#B7BCC4', // soft gray — visible against grandTotalRow without being harsh
    hoverRow: '#F9FAFB',
  },
  {
    id: 'blue',
    label: 'Blue',
    header: '#DBEAFE',
    headerText: '#1E3A5F',
    row: '#FFFFFF',
    zebraRow: '#EFF6FF',
    border: '#BFDBFE',
    subtotalRow: '#DBEAFE',
    grandTotalRow: '#BFDBFE',
    grandTotalBorder: '#93C5FD', // blue-300 — visible against grandTotalRow without being harsh
    hoverRow: '#EFF6FF',
  },
];

/** Look up a theme by id, falling back to the default gray theme */
export function getTableTheme(themeId?: string): TableTheme {
  return TABLE_THEMES.find((t) => t.id === themeId) ?? TABLE_THEMES[0];
}
