import { type Page, type Route, expect } from '@playwright/test';
import { type Resource, ApiClient } from '../support/api-client';
import { type RoleName, e2eTitle, ROLE_USERS, SEED } from '../support/env';
import { setReportGeneralAccess } from './helpers';

/**
 * Extra setup for the reports gap specs (gaps-*.spec.ts). Read-only use of helpers.ts / support/*.
 */

type Track = (resource: Resource, id: number) => void;

/** Body of every forced backend failure — lib/api.ts surfaces `detail` as the error message. */
export const FORCED_FAILURE = 'e2e forced failure';
export const FORCED_FAILURE_STATUS = 500;

/** Fulfill a route with a backend-style 500 whose message the toasts show verbatim. */
export function failRoute(route: Route) {
  return route.fulfill({ status: FORCED_FAILURE_STATUS, json: { detail: FORCED_FAILURE } });
}

/** Comment endpoints of one report */
export const COMMENTS_URL = (reportId: number) => new RegExp(`/api/reports/${reportId}/comments/$`);
export const MARK_READ_URL = (reportId: number) =>
  new RegExp(`/api/reports/${reportId}/comments/mark-read/$`);
export const COMMENT_STATES_URL = (reportId: number) =>
  new RegExp(`/api/reports/${reportId}/comments/states/$`);

/** Backend session of another org role (its storage state is written by global.setup). */
export function roleApi(role: RoleName): Promise<ApiClient> {
  return ApiClient.create(ROLE_USERS[role].statePath);
}

/** orguser id of an org member, by email. */
export async function orgUserId(api: ApiClient, email: string): Promise<number> {
  const people = await api.get<Array<{ email: string; orguser_id: number }>>(
    '/api/v1/organizations/people'
  );
  const person = people.find((p) => p.email.toLowerCase() === email.toLowerCase());
  if (!person) throw new Error(`${email} is not a member of the e2e org`);
  return person.orguser_id;
}

/**
 * Direct grant for `role` on a report, then Private general access so the grant is that user's
 * only way in (same as share.spec's shareViewOnly, but any level).
 */
export async function grantReport(
  api: ApiClient,
  reportId: number,
  role: RoleName,
  level: 'view' | 'edit'
) {
  const principalId = await orgUserId(api, ROLE_USERS[role].email!);
  await api.post(`/api/access/report/${reportId}/grants`, {
    principals: [{ principal_type: 'user', principal_id: principalId, access_level: level }],
  });
  await setReportGeneralAccess(reportId, 'private');
}

/** Post a comment through the API as the given client (not the flow under test). */
export async function postComment(
  api: ApiClient,
  reportId: number,
  body: { target_type: 'summary' | 'chart' | 'kpi'; target_id?: number; content: string }
): Promise<number> {
  const res = await api.post<{ data: { id: number } }>(`/api/reports/${reportId}/comments/`, {
    ...body,
    mentioned_emails: [],
  });
  return res.data.id;
}

// Grid sizes (rowHeight 20px) — tall enough for the table rows / map regions to render
const CELL_H = 20;
const HALF_WIDTH = 6;

/** Table chart on the education mart: statename × SUM(students) — shape of seed chart 1235, no saved metrics. */
function tableChartBody(title: string): Record<string, unknown> {
  const { schema, table } = SEED.datasets.education;
  return {
    title,
    chart_type: 'table',
    computation_type: 'aggregated',
    schema_name: schema,
    table_name: table,
    extra_config: {
      dimensions: [{ column: 'statename', enable_drill_down: false }],
      dimension_columns: ['statename'],
      dimension_column: 'statename',
      metrics: [{ column: 'students', aggregation: 'sum', alias: 'Students Reached' }],
      sort: [{ column: 'Students Reached', direction: 'desc' }],
      filters: [],
      pagination: { enabled: false, page_size: 50 },
      customizations: { theme: 'gray', zebraRows: true },
    },
  };
}

/** Map chart on the education mart: SUM(students) by state, India states GeoJSON — shape of seed chart 1239. */
function mapChartBody(title: string): Record<string, unknown> {
  const { schema, table } = SEED.datasets.education;
  return {
    title,
    chart_type: 'map',
    computation_type: 'aggregated',
    schema_name: schema,
    table_name: table,
    extra_config: {
      metrics: [{ column: 'students', aggregation: 'sum', alias: 'SUM(students)' }],
      value_column: 'students',
      aggregate_column: 'students',
      aggregate_function: 'sum',
      geographic_column: 'statename',
      // Seed GeoJSON "India states" (read-only reference, same as seed chart 1239)
      selected_geojson_id: 35,
      geographic_hierarchy: {
        country_code: 'IND',
        base_level: { label: 'State', level: 0, column: 'statename', region_type: 'state' },
        drill_down_levels: [],
      },
      filters: [],
      sort: null,
      pagination: null,
      customizations: {
        colorScheme: 'Blues',
        showLegend: true,
        showTooltip: true,
        nullValueLabel: 'No Data',
      },
    },
  };
}

export interface TableMapDashboard {
  dashboardId: number;
  tableChartId: number;
  tableTitle: string;
  mapChartId: number;
  mapTitle: string;
}

/** Native e2e dashboard with one table chart and one map chart side by side. */
export async function createTableMapDashboard(
  api: ApiClient,
  track: Track,
  name: string
): Promise<TableMapDashboard> {
  const tableChart = await api.post<{ id: number; title: string }>(
    '/api/charts/',
    tableChartBody(e2eTitle(`${name}-table`))
  );
  track('charts', tableChart.id);
  const mapChart = await api.post<{ id: number; title: string }>(
    '/api/charts/',
    mapChartBody(e2eTitle(`${name}-map`))
  );
  track('charts', mapChart.id);
  const dash = await api.post<{ id: number; title: string }>('/api/dashboards/', {
    title: e2eTitle(`${name}-dash`),
    grid_columns: 12,
  });
  track('dashboards', dash.id);

  await api.put(`/api/dashboards/${dash.id}/`, {
    tabs: [
      {
        id: 'tab-1',
        title: 'Main',
        layout_config: [
          { i: 'chart-1', x: 0, y: 0, w: HALF_WIDTH, h: CELL_H },
          { i: 'chart-2', x: HALF_WIDTH, y: 0, w: HALF_WIDTH, h: CELL_H },
        ],
        components: {
          'chart-1': {
            id: 'chart-1',
            type: 'chart',
            config: { chartId: tableChart.id, chartType: 'table', title: tableChart.title },
          },
          'chart-2': {
            id: 'chart-2',
            type: 'chart',
            config: { chartId: mapChart.id, chartType: 'map', title: mapChart.title },
          },
        },
      },
    ],
  });
  return {
    dashboardId: dash.id,
    tableChartId: tableChart.id,
    tableTitle: tableChart.title,
    mapChartId: mapChart.id,
    mapTitle: mapChart.title,
  };
}

/** Hold matching requests until `release()` is called (to observe transient loading states). */
export async function holdRoute(page: Page, url: RegExp, method = 'GET') {
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => (release = resolve));
  let seen: () => void = () => {};
  const held = new Promise<void>((resolve) => (seen = resolve));
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    seen();
    await released;
    await route.fallback();
  });
  return { release, held };
}

// Shared staging backend under parallel load: /view/ (it re-resolves the frozen dashboard) can
// exceed the 10s default expect timeout. Same budget as support/render.ts RENDER_TIMEOUT_MS.
const REPORT_LOAD_TIMEOUT_MS = 30_000;

/** helpers.openReport with a load budget that survives a busy staging backend. */
export async function openReport(page: Page, reportId: number, query = '') {
  await page.goto(`/reports/${reportId}${query}`);
  await expect(page.getByTestId('report-title')).toBeVisible({ timeout: REPORT_LOAD_TIMEOUT_MS });
}
