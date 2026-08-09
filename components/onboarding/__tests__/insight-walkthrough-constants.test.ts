import {
  WALKTHROUGH_STAGE_ORDER,
  OWN_DATA_WALKTHROUGH_STAGE_ORDER,
  AUTOMATE_PIPELINE_STAGE_ORDER,
  POST_SYNC_STAGE_FOR,
  CHART_ENTRY_STAGE,
  getStoredWalkthroughStage,
  saveWalkthroughStage,
  clearWalkthroughState,
  clearWalkthroughStorage,
  markWalkthroughDone,
  hasFinishedWalkthrough,
  markConnectedRealData,
  hasConnectedRealData,
  markPipelineCreated,
  hasPipelineCreated,
  markChartCreated,
  hasChartCreated,
  savePath,
  getStoredPath,
  saveTrackedConnection,
  getStoredTrackedConnection,
  getActiveWalkthroughFlow,
  saveActiveWalkthroughFlow,
  isStageBefore,
  isWizardCoachedStage,
  getResumeAnchorStage,
  flowForPath,
  SOURCE_NEXT_STAGE_FOR,
} from '../insight-walkthrough-constants';
import {
  setWalkthroughScope,
  clearWalkthroughScope,
  USER_A,
  USER_B,
  ORG_A,
  ORG_B,
} from './walkthrough-scope-utils';

describe('insight-walkthrough-constants', () => {
  beforeEach(() => {
    localStorage.clear();
    setWalkthroughScope(USER_A, ORG_A);
  });

  describe('stage storage', () => {
    it('has no stored stage before anything runs', () => {
      expect(getStoredWalkthroughStage('insights')).toBeNull();
    });

    it('round-trips a saved stage', () => {
      saveWalkthroughStage('insights', 'kpi_intro');
      expect(getStoredWalkthroughStage('insights')).toBe('kpi_intro');
    });

    it('is not done until markWalkthroughDone is called', () => {
      expect(hasFinishedWalkthrough('insights')).toBe(false);
      markWalkthroughDone('insights');
      expect(hasFinishedWalkthrough('insights')).toBe(true);
    });

    it('clearWalkthroughState removes the stage but not the done flag', () => {
      saveWalkthroughStage('insights', 'kpi_intro');
      markWalkthroughDone('insights');
      clearWalkthroughState('insights');
      expect(getStoredWalkthroughStage('insights')).toBeNull();
      expect(hasFinishedWalkthrough('insights')).toBe(true);
    });

    it('writes nothing at all when there is no selected org yet', () => {
      clearWalkthroughScope();
      saveWalkthroughStage('insights', 'kpi_intro');
      expect(getStoredWalkthroughStage('insights')).toBeNull();
      setWalkthroughScope(USER_A, ORG_A);
      expect(getStoredWalkthroughStage('insights')).toBeNull();
    });
  });

  describe('scoping', () => {
    it('keys state per org, so onboarding one org says nothing about another', () => {
      saveWalkthroughStage('insights', 'kpi_intro');
      setWalkthroughScope(USER_A, ORG_B);
      expect(getStoredWalkthroughStage('insights')).toBeNull();
      saveWalkthroughStage('insights', 'share');
      setWalkthroughScope(USER_A, ORG_A);
      expect(getStoredWalkthroughStage('insights')).toBe('kpi_intro');
    });

    it('keys state per user, so a shared browser does not blur two people together', () => {
      saveWalkthroughStage('insights', 'kpi_intro');
      markChartCreated();
      setWalkthroughScope(USER_B, ORG_A);
      expect(getStoredWalkthroughStage('insights')).toBeNull();
      expect(hasChartCreated()).toBe(false);
    });

    it('keys per-flow state per flow, so starting one never overwrites the other', () => {
      // The regression this whole split exists for: build-insights left half-finished, then
      // the automate-pipeline walkthrough started on top of it.
      savePath('insights', 'own_data');
      saveWalkthroughStage('insights', 'chart_create');
      saveTrackedConnection('insights', 'conn-insights');

      savePath('automate_pipeline', 'automate_pipeline');
      saveWalkthroughStage('automate_pipeline', 'pipeline_ingest');
      saveTrackedConnection('automate_pipeline', 'conn-pipeline');

      expect(getStoredWalkthroughStage('insights')).toBe('chart_create');
      expect(getStoredPath('insights')).toBe('own_data');
      expect(getStoredTrackedConnection('insights')).toBe('conn-insights');
      expect(getStoredTrackedConnection('automate_pipeline')).toBe('conn-pipeline');
    });

    it('keeps each flow’s done flag to itself', () => {
      markWalkthroughDone('automate_pipeline');
      expect(hasFinishedWalkthrough('automate_pipeline')).toBe(true);
      // Finishing one used to set a single org-wide flag, which stopped the other from ever
      // resuming.
      expect(hasFinishedWalkthrough('insights')).toBe(false);
    });

    it('shares milestones across flows — work done once counts for both', () => {
      markConnectedRealData();
      expect(hasConnectedRealData()).toBe(true);
      // No flow argument exists for milestones by design: they're facts about the org, not
      // progress through a particular walkthrough.
      expect(hasPipelineCreated()).toBe(false);
      markPipelineCreated();
      expect(hasPipelineCreated()).toBe(true);
    });
  });

  describe('clearWalkthroughStorage', () => {
    it('drops the resolving flow’s own state', () => {
      savePath('insights', 'sample');
      saveWalkthroughStage('insights', 'share');
      saveTrackedConnection('insights', 'conn-1');

      clearWalkthroughStorage('insights');

      expect(getStoredPath('insights')).toBeNull();
      expect(getStoredWalkthroughStage('insights')).toBeNull();
      expect(getStoredTrackedConnection('insights')).toBeNull();
    });

    it('leaves the other flow’s in-progress run untouched', () => {
      savePath('automate_pipeline', 'automate_pipeline');
      saveWalkthroughStage('automate_pipeline', 'pipeline_pick_table');
      savePath('insights', 'own_data');

      clearWalkthroughStorage('insights');

      expect(getStoredWalkthroughStage('automate_pipeline')).toBe('pipeline_pick_table');
      expect(getStoredPath('automate_pipeline')).toBe('automate_pipeline');
    });

    it('leaves shared milestones alone, so the other flow doesn’t re-ask for done work', () => {
      markConnectedRealData();
      markChartCreated();
      markPipelineCreated();

      clearWalkthroughStorage('insights');

      expect(hasConnectedRealData()).toBe(true);
      expect(hasChartCreated()).toBe(true);
      expect(hasPipelineCreated()).toBe(true);
    });

    it('never reaches another org’s keys', () => {
      setWalkthroughScope(USER_A, ORG_B);
      saveWalkthroughStage('insights', 'kpi_intro');
      setWalkthroughScope(USER_A, ORG_A);
      saveWalkthroughStage('insights', 'share');

      clearWalkthroughStorage('insights');

      setWalkthroughScope(USER_A, ORG_B);
      expect(getStoredWalkthroughStage('insights')).toBe('kpi_intro');
    });
  });

  describe('active flow pointer', () => {
    it('is null until a flow is started, then reports the last one', () => {
      expect(getActiveWalkthroughFlow()).toBeNull();
      saveActiveWalkthroughFlow('insights');
      expect(getActiveWalkthroughFlow()).toBe('insights');
      saveActiveWalkthroughFlow('automate_pipeline');
      expect(getActiveWalkthroughFlow()).toBe('automate_pipeline');
    });

    it('survives clearing a flow’s own state — it is scoped to the user, not the flow', () => {
      saveActiveWalkthroughFlow('automate_pipeline');
      clearWalkthroughStorage('insights');
      expect(getActiveWalkthroughFlow()).toBe('automate_pipeline');
    });
  });

  describe('flowForPath', () => {
    it('maps both insight forks onto the insights flow and the pipeline onto its own', () => {
      expect(flowForPath('sample')).toBe('insights');
      expect(flowForPath('own_data')).toBe('insights');
      // A skip at fork2, before either fork was picked, still counts as the insights flow.
      expect(flowForPath(null)).toBe('insights');
      expect(flowForPath('automate_pipeline')).toBe('automate_pipeline');
    });
  });

  describe('stage orders', () => {
    it('orders fork2 first and the share-link copy last', () => {
      expect(WALKTHROUGH_STAGE_ORDER[0]).toBe('fork2');
      // Copying the public link is the final action — see dashboard-native-view.tsx.
      expect(WALKTHROUGH_STAGE_ORDER[WALKTHROUGH_STAGE_ORDER.length - 1]).toBe('share_copy_link');
    });

    it('runs the pipeline fork from the Ingest nudge to the created pipeline, and stops there', () => {
      // Opens on the sidebar nudge, not on New Source: picking the flow no longer navigates
      // anywhere — the user clicks Ingest themselves.
      expect(AUTOMATE_PIPELINE_STAGE_ORDER[0]).toBe('pipeline_ingest_nudge');
      // A scheduled pipeline is this walkthrough's deliverable. Charting what it produces is
      // the build-insights flow, started separately — so no chart or dashboard stage here.
      expect(AUTOMATE_PIPELINE_STAGE_ORDER[AUTOMATE_PIPELINE_STAGE_ORDER.length - 1]).toBe(
        'pipeline_create_it'
      );
      expect(AUTOMATE_PIPELINE_STAGE_ORDER).not.toContain('chart_intro');
      expect(AUTOMATE_PIPELINE_STAGE_ORDER).not.toContain('dashboard_intro');
      expect(AUTOMATE_PIPELINE_STAGE_ORDER).not.toContain('share_copy_link');
    });

    it('opens both real-data forks with New Source, the source picker, then its Next button', () => {
      expect(OWN_DATA_WALKTHROUGH_STAGE_ORDER.slice(0, 4)).toEqual([
        'fork2',
        'own_data_ingest',
        'own_data_pick_source',
        'own_data_source_next',
      ]);
      // One beat earlier than the own-data fork: that one is reached THROUGH fork2, which
      // navigates, so it lands on /ingest already. This fork starts wherever the user was.
      expect(AUTOMATE_PIPELINE_STAGE_ORDER.slice(0, 4)).toEqual([
        'pipeline_ingest_nudge',
        'pipeline_ingest',
        'pipeline_pick_source',
        'pipeline_source_next',
      ]);
    });

    it('sends the own-data fork from its first sync straight to building a chart', () => {
      // The core regression guard for this flow: own-data is ingest -> chart -> dashboard ->
      // share. Transform and Orchestrate belong to the automate-pipeline walkthrough alone,
      // and dragging own-data users through them is exactly what this split removed.
      expect(OWN_DATA_WALKTHROUGH_STAGE_ORDER.some((stage) => stage.startsWith('pipeline_'))).toBe(
        false
      );
      const order = OWN_DATA_WALKTHROUGH_STAGE_ORDER;
      expect(order.indexOf('own_data_source_next')).toBeLessThan(order.indexOf('chart_intro'));
      expect(order.indexOf('chart_intro')).toBeLessThan(order.indexOf('dashboard_intro'));
    });

    it('keeps Transform and Orchestrate in the automate-pipeline fork, in that order', () => {
      const order = AUTOMATE_PIPELINE_STAGE_ORDER;
      expect(order.indexOf('pipeline_source_next')).toBeLessThan(
        order.indexOf('pipeline_transform_intro')
      );
      expect(order.indexOf('pipeline_transform_intro')).toBeLessThan(
        order.indexOf('pipeline_orchestrate_intro')
      );
      expect(order.indexOf('pipeline_orchestrate_intro')).toBeLessThan(
        order.indexOf('pipeline_create_it')
      );
    });

    it('walks the canvas in the order the panels actually appear', () => {
      const order = AUTOMATE_PIPELINE_STAGE_ORDER;
      const canvas = [
        'pipeline_pick_table',
        'pipeline_select_node',
        'pipeline_pick_function',
        'pipeline_drop_columns',
        'pipeline_save_table',
        'pipeline_name_table',
        'pipeline_save_new_table',
        'pipeline_table_built',
        'pipeline_publish_commit',
      ];
      const start = order.indexOf('pipeline_pick_table');
      expect(order.slice(start, start + canvas.length)).toEqual(canvas);
      // Publishing is the last thing the transform leg asks for — Orchestrate follows it.
      expect(order.indexOf('pipeline_publish_commit')).toBeLessThan(
        order.indexOf('pipeline_orchestrate_intro')
      );
    });

    it('walks the chart builder in the order the pages actually appear', () => {
      const order = OWN_DATA_WALKTHROUGH_STAGE_ORDER;
      const sequence = [
        'chart_intro',
        'chart_create',
        'chart_pick_table',
        'chart_pick_type',
        'chart_data_config',
        'chart_styling',
        'chart_save',
        'chart_dashboard_nudge',
      ];
      expect(order.slice(order.indexOf('chart_intro'), order.indexOf('chart_intro') + 8)).toEqual(
        sequence
      );
    });

    it('adds the chart before the KPI on the real-data forks', () => {
      // A chart already exists by this point in both, so it goes on the canvas first — the
      // opposite of the sample fork, which builds the KPI first.
      const order = OWN_DATA_WALKTHROUGH_STAGE_ORDER;
      expect(order.indexOf('builder_add_chart_first')).toBeLessThan(
        order.indexOf('builder_add_kpi_second')
      );
      expect(WALKTHROUGH_STAGE_ORDER.indexOf('builder_add_kpi')).toBeLessThan(
        WALKTHROUGH_STAGE_ORDER.indexOf('builder_add_chart')
      );
    });

    it('puts the public-access switch between opening the share dialog and copying the link', () => {
      // There is no link to copy until the dashboard is public, so the switch has to come
      // first — in both forks that reach a dashboard. (The pipeline fork ends at the created
      // pipeline and never shares anything.)
      for (const order of [WALKTHROUGH_STAGE_ORDER, OWN_DATA_WALKTHROUGH_STAGE_ORDER]) {
        expect(order.indexOf('share')).toBeLessThan(order.indexOf('share_public_toggle'));
        expect(order.indexOf('share_public_toggle')).toBeLessThan(order.indexOf('share_copy_link'));
      }
    });
  });

  describe('POST_SYNC_STAGE_FOR', () => {
    it('rejoins each fork where its own work continues', () => {
      expect(POST_SYNC_STAGE_FOR.own_data).toBe('chart_intro');
      expect(POST_SYNC_STAGE_FOR.automate_pipeline).toBe('pipeline_transform_intro');
    });

    it('opens the chart tail at its first stage, for a direct entry with no fork', () => {
      // Someone who already has real data (they automated a pipeline, say) gets no
      // sample/own-data question — build-insights opens straight here.
      expect(CHART_ENTRY_STAGE).toBe('chart_intro');
      expect(OWN_DATA_WALKTHROUGH_STAGE_ORDER).toContain(CHART_ENTRY_STAGE);
    });

    it('is reachable from either ingest stage of its own fork', () => {
      expect(isStageBefore('own_data', 'own_data_ingest', POST_SYNC_STAGE_FOR.own_data)).toBe(true);
      expect(isStageBefore('own_data', 'own_data_pick_source', POST_SYNC_STAGE_FOR.own_data)).toBe(
        true
      );
      expect(
        isStageBefore(
          'automate_pipeline',
          'pipeline_pick_source',
          POST_SYNC_STAGE_FOR.automate_pipeline
        )
      ).toBe(true);
    });
  });

  describe('resume anchors', () => {
    it('rewinds each fork’s in-wizard stages to its own New Source step', () => {
      // Both targets live inside the add-source wizard, which a cold page load doesn't have
      // open — resuming as-is would wait on a selector that never appears.
      expect(getResumeAnchorStage('own_data_pick_source')).toBe('own_data_ingest');
      expect(getResumeAnchorStage('pipeline_pick_source')).toBe('pipeline_ingest');
      expect(getResumeAnchorStage('own_data_source_next')).toBe('own_data_ingest');
      expect(getResumeAnchorStage('pipeline_source_next')).toBe('pipeline_ingest');
      // The New Source stages themselves are reachable cold, so they resume as themselves.
      expect(getResumeAnchorStage('own_data_ingest')).toBe('own_data_ingest');
      expect(getResumeAnchorStage('pipeline_ingest')).toBe('pipeline_ingest');
    });

    it('resumes the sidebar-anchored stages as themselves, wherever the user is', () => {
      // Both point at a sidebar link, which every route renders — so a refresh keeps the
      // coachmark on screen instead of parking it until the user reaches a particular page.
      expect(getResumeAnchorStage('chart_intro')).toBe('chart_intro');
      expect(getResumeAnchorStage('chart_dashboard_nudge')).toBe('chart_dashboard_nudge');
    });

    it('rewinds every mid-build chart stage to "click Create chart"', () => {
      // /charts/new cold-loads with nothing picked, and /charts/new/configure can't be reached
      // at all without a chart in progress.
      for (const stage of [
        'chart_pick_table',
        'chart_pick_type',
        'chart_data_config',
        'chart_styling',
        'chart_save',
      ] as const) {
        expect(getResumeAnchorStage(stage)).toBe('chart_create');
      }
      expect(getResumeAnchorStage('chart_create')).toBe('chart_create');
    });

    it('rewinds every mid-build canvas stage to "pick a table"', () => {
      // A selected node and an open operation panel are both gone on reload.
      for (const stage of [
        'pipeline_select_node',
        'pipeline_pick_function',
        'pipeline_drop_columns',
        'pipeline_save_table',
        'pipeline_name_table',
        'pipeline_save_new_table',
      ] as const) {
        expect(getResumeAnchorStage(stage)).toBe('pipeline_pick_table');
      }
      // The Publish dialog is gone too, but the button that opens it survives a cold load.
      expect(getResumeAnchorStage('pipeline_publish_commit')).toBe('pipeline_table_built');
      expect(getResumeAnchorStage('pipeline_table_built')).toBe('pipeline_table_built');
    });

    it('rewinds the real-data forks’ builder stages to "create a dashboard"', () => {
      expect(getResumeAnchorStage('builder_add_chart_first')).toBe('dashboard_intro');
      expect(getResumeAnchorStage('builder_add_kpi_second')).toBe('dashboard_intro');
    });
  });

  it('flags the picker and its Next button as living inside the wizard', () => {
    expect(isWizardCoachedStage('own_data_pick_source')).toBe(true);
    expect(isWizardCoachedStage('pipeline_pick_source')).toBe(true);
    expect(isWizardCoachedStage('own_data_source_next')).toBe(true);
    expect(isWizardCoachedStage('pipeline_source_next')).toBe(true);
    expect(isWizardCoachedStage('own_data_ingest')).toBe(false);
    expect(isWizardCoachedStage(null)).toBe(false);
  });

  it('pairs each fork’s picker stage with its own Next-button stage', () => {
    // Cross-fork leakage here would rewind a user into the other fork's ingest step.
    expect(SOURCE_NEXT_STAGE_FOR.own_data_pick_source).toBe('own_data_source_next');
    expect(SOURCE_NEXT_STAGE_FOR.pipeline_pick_source).toBe('pipeline_source_next');
  });

  it('isStageBefore treats a stage outside this fork as behind, so nothing can stall on it', () => {
    // builder_add_kpi belongs to the sample fork only; the own-data fork adds the chart first.
    expect(isStageBefore('own_data', 'builder_add_kpi', 'builder_save')).toBe(true);
    expect(isStageBefore('sample', 'kpi_target', 'kpi_submit')).toBe(true);
    expect(isStageBefore('sample', 'kpi_submit', 'kpi_target')).toBe(false);
    // Same stage is not "before" itself — a repeated checkpoint is a no-op.
    expect(isStageBefore('sample', 'kpi_submit', 'kpi_submit')).toBe(false);
  });

  it('lists the KPI wizard stages in the order its handlers actually fire them', () => {
    // Regression guard: the wizard goes Direction -> Time Column -> Continue. With Continue
    // listed first, isStageBefore called Time Column "later", so the Continue checkpoint
    // could never catch a user up from it and the flow stalled with no coach on screen.
    const order = WALKTHROUGH_STAGE_ORDER;
    expect(order.indexOf('kpi_direction')).toBeLessThan(order.indexOf('kpi_time_column'));
    expect(order.indexOf('kpi_time_column')).toBeLessThan(order.indexOf('kpi_continue'));
    expect(order.indexOf('kpi_continue')).toBeLessThan(order.indexOf('kpi_type'));
    expect(isStageBefore('sample', 'kpi_time_column', 'kpi_continue')).toBe(true);
  });
});
