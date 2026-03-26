// Dashboard Types

export type DashboardType = 'implementation' | 'impact' | 'funder' | 'usage';

// Dashboard Layout Item - represents position of a component on the grid
export interface DashboardLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
}

// Dashboard Component - represents a chart, text, or filter element
export interface DashboardComponentConfig {
  id: string;
  type: 'chart' | 'text' | 'filter';
  config: Record<string, unknown>;
}

// Dashboard Tab - represents a single tab with its own layout and components
export interface DashboardTab {
  id: string;
  title: string;
  layout_config: DashboardLayoutItem[];
  components: Record<string, DashboardComponentConfig>;
}

// Dashboard Tabs Data - frontend state structure for managing tabs
export interface DashboardTabsData {
  tabs: DashboardTab[];
  activeTabId: string;
}
