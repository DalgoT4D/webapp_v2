import {
  stageOrderFor,
  type WalkthroughPath,
  type WalkthroughStage,
} from './insight-walkthrough-constants';

/** Steps sharing live, editable UI. Crossing a boundary could discard a draft or
 * repeat a create/save/publish action, so Back only reviews within these groups. */
const REVIEW_GROUPS: WalkthroughStage[][] = [
  [
    'kpi_metric',
    'kpi_step1_continue',
    'kpi_target',
    'kpi_direction',
    'kpi_time_column',
    'kpi_continue',
    'kpi_thresholds',
    'kpi_program_tags',
    'kpi_type',
    'kpi_submit',
  ],
  ['kpi_duration', 'kpi_add_note', 'kpi_close_drawer'],
  ['dashboard_nudge', 'chart_dashboard_nudge', 'dashboard_intro'],
  [
    'builder_add_kpi',
    'builder_add_chart',
    'builder_add_chart_first',
    'builder_add_kpi_second',
    'builder_resize',
    'builder_save',
    'builder_preview',
  ],
  ['share_public_toggle', 'share_copy_link'],
  ['own_data_pick_source', 'own_data_source_next'],
  ['own_data_sheet_link', 'own_data_sheet_auth', 'own_data_config_next'],
  ['own_data_streams_scroll', 'own_data_streams_cast', 'own_data_connection_create'],
  ['chart_intro', 'chart_create'],
  ['chart_pick_table', 'chart_pick_type', 'chart_continue'],
  ['chart_data_config', 'chart_styling', 'chart_save'],
  ['pipeline_ingest_nudge', 'pipeline_ingest'],
  ['pipeline_pick_source', 'pipeline_source_next'],
  ['pipeline_sheet_link', 'pipeline_sheet_auth', 'pipeline_config_next'],
  ['pipeline_streams_scroll', 'pipeline_streams_cast', 'pipeline_connection_create'],
  ['pipeline_transform_intro', 'pipeline_workflow_intro'],
  [
    'pipeline_select_node',
    'pipeline_pick_function',
    'pipeline_drop_columns',
    'pipeline_save_table',
  ],
  ['pipeline_name_table', 'pipeline_save_new_table'],
  ['pipeline_orchestrate_nudge', 'pipeline_orchestrate_intro'],
  [
    'pipeline_add_connection',
    'pipeline_run_transform',
    'pipeline_set_schedule',
    'pipeline_create_it',
  ],
];

export const KPI_STAGE_STEP: Partial<Record<WalkthroughStage, 1 | 2 | 3>> = {
  kpi_metric: 1,
  kpi_step1_continue: 1,
  kpi_target: 2,
  kpi_direction: 2,
  kpi_time_column: 2,
  kpi_continue: 2,
  kpi_thresholds: 3,
  kpi_program_tags: 3,
  kpi_type: 3,
  kpi_submit: 3,
};

export function reviewStagesFor(path: WalkthroughPath | null, stage: WalkthroughStage) {
  const group = REVIEW_GROUPS.find((stages) => stages.includes(stage));
  return group ? stageOrderFor(path).filter((candidate) => group.includes(candidate)) : [];
}

export function previousReviewStage(
  path: WalkthroughPath | null,
  stage: WalkthroughStage,
  available: (candidate: WalkthroughStage) => boolean
): WalkthroughStage | null {
  const stages = reviewStagesFor(path, stage);
  const index = stages.indexOf(stage);
  return stages.slice(0, Math.max(0, index)).reverse().find(available) ?? null;
}

export function nextReviewStage(
  path: WalkthroughPath | null,
  stage: WalkthroughStage,
  returnStage: WalkthroughStage | null,
  available: (candidate: WalkthroughStage) => boolean
): WalkthroughStage | null {
  const stages = reviewStagesFor(path, stage);
  const end = returnStage ? stages.indexOf(returnStage) : -1;
  const current = stages.indexOf(stage);
  if (current < 0 || end <= current) return null;
  return stages.slice(current + 1, end + 1).find(available) ?? null;
}
