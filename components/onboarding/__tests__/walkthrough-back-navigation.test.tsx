import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightWalkthroughCoachmark } from '../insight-walkthrough-coachmark';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { mockApiPost } from '@/test-utils/api';
import type { WalkthroughPath, WalkthroughStage } from '../insight-walkthrough-constants';

jest.mock('next/navigation', () => ({ usePathname: () => window.location.pathname }));

type Case = [WalkthroughPath, string, WalkthroughStage, string, WalkthroughStage, string];
const cases: Case[] = [
  [
    'sample',
    '/kpis',
    'kpi_direction',
    'kpi-form-direction-field',
    'kpi_target',
    'kpi-form-target-field',
  ],
  ['sample', '/kpis', 'kpi_submit', 'kpi-form-submit-btn', 'kpi_type', 'kpi-form-type-field'],
  [
    'sample',
    '/kpis',
    'kpi_close_drawer',
    'kpi-detail-close-btn',
    'kpi_add_note',
    'kpi-detail-add-note-btn',
  ],
  [
    'sample',
    '/dashboards/7/edit',
    'builder_add_chart',
    'add-chart-btn',
    'builder_add_kpi',
    'add-kpi-btn',
  ],
  [
    'own_data',
    '/dashboards/7/edit',
    'builder_add_kpi_second',
    'add-kpi-btn',
    'builder_add_chart_first',
    'add-chart-btn',
  ],
  [
    'sample',
    '/dashboards/7',
    'share_copy_link',
    'copy-link-btn',
    'share_public_toggle',
    'general-access-select',
  ],
  [
    'own_data',
    '/ingest',
    'own_data_source_next',
    'wizard-select-next-btn',
    'own_data_pick_source',
    'source-picker-body',
  ],
  [
    'own_data',
    '/ingest',
    'own_data_config_next',
    'wizard-next-btn',
    'own_data_sheet_auth',
    'gsheets-auth-choice',
  ],
  [
    'own_data',
    '/ingest',
    'own_data_connection_create',
    'save-connection-btn',
    'own_data_streams_cast',
    'streams-table',
  ],
  [
    'own_data',
    '/charts/new',
    'chart_continue',
    'chart-type-continue-button',
    'chart_pick_type',
    'chart-type-grid',
  ],
  [
    'own_data',
    '/charts/new/configure',
    'chart_save',
    'chart-edit-save-button',
    'chart_styling',
    'chart-styling-tab',
  ],
  [
    'automate_pipeline',
    '/ingest',
    'pipeline_source_next',
    'wizard-select-next-btn',
    'pipeline_pick_source',
    'source-picker-body',
  ],
  [
    'automate_pipeline',
    '/ingest',
    'pipeline_config_next',
    'wizard-next-btn',
    'pipeline_sheet_auth',
    'gsheets-auth-choice',
  ],
  [
    'automate_pipeline',
    '/ingest',
    'pipeline_connection_create',
    'save-connection-btn',
    'pipeline_streams_cast',
    'streams-table',
  ],
  [
    'automate_pipeline',
    '/transform/canvas',
    'pipeline_save_table',
    'create-table-btn',
    'pipeline_drop_columns',
    'drop-search',
  ],
  [
    'automate_pipeline',
    '/transform/canvas',
    'pipeline_save_new_table',
    'save-table-btn',
    'pipeline_name_table',
    'output-name-input',
  ],
  [
    'automate_pipeline',
    '/orchestrate/create',
    'pipeline_create_it',
    'submit-btn',
    'pipeline_set_schedule',
    'cron-container',
  ],
];

function target(id: string, parent: HTMLElement = document.body) {
  const element = document.createElement('div');
  element.dataset.testid = id;
  parent.appendChild(element);
  return element;
}

function start(path: WalkthroughPath, stage: WalkthroughStage, route: string) {
  window.history.replaceState({}, '', route);
  useInsightWalkthroughStore.setState({
    active: true,
    orgSlug: 'org-a',
    flow: path === 'automate_pipeline' ? path : 'insights',
    path,
    stage,
    reviewReturnStage: null,
    trackedConnectionId: null,
    suppressCoachmark: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
});

it.each(cases)(
  '%s reviews %s %s without changing values or repeating actions',
  async (path, route, stage, currentId, previous, previousId) => {
    start(path, stage, route);
    const form = document.createElement('div');
    // Mirror a wizard/dialog for its conditional hint handling; page stages remain plain.
    if (route === '/ingest' || route === '/kpis') form.setAttribute('role', 'dialog');
    document.body.appendChild(form);
    target(currentId, form);
    const earlier = target(previousId, form);
    const input = document.createElement('input');
    input.value = 'user-entered value';
    earlier.appendChild(input);
    const selection = document.createElement('input');
    selection.type = 'checkbox';
    selection.checked = true;
    earlier.appendChild(selection);
    render(<InsightWalkthroughCoachmark />);

    await userEvent.click(await screen.findByRole('button', { name: 'Back' }));
    await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe(previous));
    expect(useInsightWalkthroughStore.getState().reviewReturnStage).toBe(stage);
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe(stage));

    expect(useInsightWalkthroughStore.getState().reviewReturnStage).toBeNull();
    expect(input).toHaveValue('user-entered value');
    expect(selection).toBeChecked();
    expect(input).toBeInTheDocument();
    expect(window.location.pathname).toBe(route);
    expect(mockApiPost).not.toHaveBeenCalled();
  }
);

it('skips unavailable and hidden conditional fields in both directions', async () => {
  start('sample', 'kpi_continue', '/kpis');
  target('kpi-form-continue-btn');
  target('kpi-form-time-column-field').hidden = true;
  target('kpi-form-direction-field');
  render(<InsightWalkthroughCoachmark />);
  await userEvent.click(await screen.findByRole('button', { name: 'Back' }));
  expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_direction');
  await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
  expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_continue');
});

it.each(['own_data', 'pipeline'] as const)(
  'does not resurrect casting for a non-cast %s source',
  async (prefix) => {
    start(
      prefix === 'pipeline' ? 'automate_pipeline' : 'own_data',
      `${prefix}_connection_create`,
      '/ingest'
    );
    target('streams-table').setAttribute('data-cast-supported', 'false');
    target('save-connection-btn');
    render(<InsightWalkthroughCoachmark />);
    await userEvent.click(await screen.findByRole('button', { name: 'Back' }));
    expect(useInsightWalkthroughStore.getState().stage).toBe(`${prefix}_streams_scroll`);
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(useInsightWalkthroughStore.getState().stage).toBe(`${prefix}_connection_create`);
  }
);

it('keeps a revisited sidebar hint visible on its destination route', async () => {
  start('automate_pipeline', 'pipeline_ingest', '/ingest');
  const link = document.createElement('a');
  link.href = '/ingest';
  document.body.appendChild(link);
  target('new-source-btn');
  render(<InsightWalkthroughCoachmark />);
  await userEvent.click(await screen.findByRole('button', { name: 'Back' }));
  await screen.findByRole('button', { name: 'Next' });
  expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_ingest_nudge');
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_ingest');
});

it('does not cross a completed create or a route that would unmount the draft', async () => {
  start('own_data', 'chart_data_config', '/charts/new/configure');
  target('chart-data-config-tab');
  target('chart-type-continue-button');
  render(<InsightWalkthroughCoachmark />);
  await screen.findByRole('button', { name: 'Got it' });
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  act(() => useInsightWalkthroughStore.getState().rewindTo('chart_continue'));
  expect(useInsightWalkthroughStore.getState().stage).toBe('chart_data_config');
});

it('ignores a second click from the old popover', async () => {
  start('sample', 'kpi_continue', '/kpis');
  target('kpi-form-continue-btn');
  target('kpi-form-direction-field');
  target('kpi-form-target-field');
  render(<InsightWalkthroughCoachmark />);
  const back = await screen.findByRole('button', { name: 'Back' });
  act(() => {
    back.click();
    back.click();
  });
  await screen.findByRole('button', { name: 'Next' });
  expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_direction');
});

it('rechecks conditional targets when a field disappears before Back is clicked', async () => {
  start('sample', 'kpi_continue', '/kpis');
  target('kpi-form-continue-btn');
  const timeColumn = target('kpi-form-time-column-field');
  target('kpi-form-direction-field');
  render(<InsightWalkthroughCoachmark />);
  const back = await screen.findByRole('button', { name: 'Back' });
  timeColumn.remove();
  await userEvent.click(back);
  expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_direction');
});
