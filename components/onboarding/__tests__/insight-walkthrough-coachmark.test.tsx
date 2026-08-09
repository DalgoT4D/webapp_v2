import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { InsightWalkthroughCoachmark } from '../insight-walkthrough-coachmark';
import type { WalkthroughStage } from '../insight-walkthrough-constants';

let mockPathname = '/kpis';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

/** Builds a stage's real target, which the coachmark waits for before rendering anything. */
function mountTarget(testId: string, inner?: HTMLElement): HTMLElement {
  const target = document.createElement('div');
  target.setAttribute('data-testid', testId);
  if (inner) target.appendChild(inner);
  document.body.appendChild(target);
  return target;
}

/** Sidebar-anchored stages target a nav link by href rather than a testid. */
function mountLink(href: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.setAttribute('href', href);
  document.body.appendChild(link);
  return link;
}

function skipButton(): HTMLElement | null {
  return document.querySelector('[data-testid="walkthrough-skip-btn"]');
}

function popoverTitle(): string {
  return document.querySelector('.driver-popover-title')?.textContent ?? '';
}

type WalkthroughState = ReturnType<typeof useInsightWalkthroughStore.getState>;

function setStage(stage: WalkthroughStage, overrides: Partial<WalkthroughState> = {}) {
  act(() => {
    useInsightWalkthroughStore.setState({
      active: true,
      orgSlug: 'org-a',
      // advanceTo persists under the live flow, so a store without one can't advance at all.
      flow: 'insights',
      stage,
      path: 'sample',
      suppressCoachmark: false,
      trackedConnectionId: null,
      ...overrides,
    });
  });
}

describe('InsightWalkthroughCoachmark', () => {
  beforeEach(() => {
    mockPathname = '/kpis';
    window.history.pushState({}, '', '/kpis');
    localStorage.clear();
    document.body.innerHTML = '';
    setStage('kpi_intro');
  });

  describe('skip affordance', () => {
    it('renders a visible top-right ✕', async () => {
      mountTarget('create-kpi-btn');
      render(<InsightWalkthroughCoachmark />);

      // Regression guard: driver.highlight() injects its own `showButtons: []`, which used to
      // leave the close button with an inline `display: none` — a coachmark with no way out.
      await waitFor(() => expect(skipButton()).not.toBeNull());
      expect(skipButton()!.textContent).toBe('✕');
      expect(skipButton()!.style.display).toBe('block');
    });

    it('ends the whole walkthrough when the ✕ is clicked', async () => {
      mountTarget('create-kpi-btn');
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(skipButton()!);

      expect(useInsightWalkthroughStore.getState().active).toBe(false);
    });
  });

  describe('the target ring', () => {
    it('outlines a CTA target', async () => {
      const target = mountTarget('create-kpi-btn');
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      expect(target.classList.contains('dalgo-tour-ring')).toBe(true);
    });

    it('leaves a form field unringed', async () => {
      // The ring means "this is the thing to press". On a dialog full of fields it made every
      // field look like the CTA — those stages are a pointer, not a call to action.
      const target = mountTarget('kpi-form-metric-field');
      setStage('kpi_metric');
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      expect(target.classList.contains('dalgo-tour-ring')).toBe(false);
    });

    it('takes the ring off when the walkthrough ends', async () => {
      const target = mountTarget('create-kpi-btn');
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(skipButton()!);

      await waitFor(() => expect(target.classList.contains('dalgo-tour-ring')).toBe(false));
    });
  });

  describe('the chart builder', () => {
    it('stays on the dataset picker when the dropdown is merely opened', async () => {
      // Opening the picker is a click, but nothing has been chosen yet. Advancing on it put
      // "Select the relevant type" on screen over a still-open dataset list.
      mockPathname = '/charts/new';
      window.history.pushState({}, '', '/charts/new');
      mountTarget('chart-dataset-selector');
      setStage('chart_pick_table', { path: 'own_data' });
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(screen.getByTestId('chart-dataset-selector'));

      expect(useInsightWalkthroughStore.getState().stage).toBe('chart_pick_table');
    });

    it('gives the informational tab stages a way forward', async () => {
      // Nothing to DO on these two — the builder has prefilled everything and they just
      // explain what each panel is for. Without a button the only way on was a second click
      // on the tab the user had already clicked to get there, which nothing suggested.
      mockPathname = '/charts/new/configure';
      window.history.pushState({}, '', '/charts/new/configure');
      mountTarget('chart-data-config-tab');
      setStage('chart_data_config', { path: 'own_data' });
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      const next = document.querySelector('.driver-popover-next-btn') as HTMLElement | null;
      expect(next).not.toBeNull();
      await userEvent.click(next!);

      expect(useInsightWalkthroughStore.getState().stage).toBe('chart_styling');
    });

    it('does not dim the page behind the builder stages', async () => {
      // These sit on a working page the user has to keep using — a picker to open, cards to
      // click. driver.js's overlay eats those clicks (`.driver-active * { pointer-events: none }`),
      // so they run in passthrough mode instead. See tour.css.
      mockPathname = '/charts/new';
      window.history.pushState({}, '', '/charts/new');
      mountTarget('chart-type-grid');
      setStage('chart_pick_type', { path: 'own_data' });
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      expect(document.body.classList.contains('dalgo-tour-passthrough')).toBe(true);
    });
  });

  describe('advancing', () => {
    it('does not move when the user clicks somewhere else on the page', async () => {
      mountTarget('kpi-form-metric-field');
      const unrelated = document.createElement('button');
      unrelated.textContent = 'somewhere else';
      document.body.appendChild(unrelated);
      setStage('kpi_metric');
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(unrelated);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_metric');
    });

    it('moves on when a dropdown-style field is clicked', async () => {
      const field = mountTarget('kpi-form-metric-field');
      setStage('kpi_metric');
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(field);

      await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_target'));
    });

    it('stays put while a typed field is being filled, and moves on once it is', async () => {
      const input = document.createElement('input');
      mountTarget('kpi-form-target-field', input);
      setStage('kpi_target');
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      // Clicking into the field and typing must NOT move the coachmark mid-keystroke.
      await userEvent.click(input);
      await userEvent.type(input, '500');
      expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_target');

      // Leaving the field is the user saying they're done with it.
      act(() => input.dispatchEvent(new FocusEvent('blur')));

      await waitFor(() =>
        expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_direction')
      );
    });

    it('does not move on when a typed field is left empty', async () => {
      const input = document.createElement('input');
      mountTarget('kpi-form-target-field', input);
      setStage('kpi_target');
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(input);
      act(() => input.dispatchEvent(new FocusEvent('blur')));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_target');
    });
  });

  describe('share dialog stages', () => {
    it('coaches the Public Access switch on a saved dashboard', async () => {
      mockPathname = '/dashboards/12';
      window.history.pushState({}, '', '/dashboards/12');
      mountTarget('share-toggle');
      setStage('share_public_toggle');

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Turn on public access'));
      // Flipping the switch is what advances it (dashboard-native-view's sharing handler),
      // so the coachmark itself must not move on a click.
      expect(useInsightWalkthroughStore.getState().stage).toBe('share_public_toggle');
    });
  });

  describe('ingest stages', () => {
    beforeEach(() => {
      mockPathname = '/ingest';
      window.history.pushState({}, '', '/ingest');
    });

    it.each([
      ['own_data', 'own_data_ingest'],
      ['automate_pipeline', 'pipeline_ingest'],
    ] as const)('coaches the New Source button on the %s fork', async (path, ingestStage) => {
      // Regression guard: own_data_ingest used to be silent, so choosing "Connect my own
      // data" dropped the user on a bare /ingest with nothing pointing anywhere.
      const button = mountTarget('new-source-btn');
      setStage(ingestStage, { path });
      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Connect your data'));

      // The handoff to the picker comes from SelectSourceStep mounting, not from this click
      // — an org with no warehouse never gets to click it (see PICK_SOURCE_STAGE_FOR).
      await userEvent.click(button);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(useInsightWalkthroughStore.getState().stage).toBe(ingestStage);
    });

    it('coaches the whole picker, not one card, once the wizard is open', async () => {
      // Any source is a valid choice here — spotlighting a single card read as the only
      // allowed answer, so the highlight covers the search box and the popular grid together.
      mountTarget('source-picker-body');
      setStage('own_data_pick_source', { path: 'own_data' });

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Pick a platform'));
      // Selecting a source is what advances it (SelectSourceStep's own handler, which sees
      // both cards and search results), so the coachmark itself must not move on a click.
      expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_pick_source');
    });

    it.each([
      ['own_data', 'own_data_source_next'],
      ['automate_pipeline', 'pipeline_source_next'],
    ] as const)('coaches the wizard’s Next button on the %s fork', async (path, stage) => {
      mountTarget('wizard-select-next-btn');
      setStage(stage, { path });

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Now set it up'));
      // A steer, not a gate — the fork rejoins on the tracked connection's first sync
      // (see tour-gate.tsx), not on this click.
      expect(useInsightWalkthroughStore.getState().stage).toBe(stage);
    });

    it.each(['own_data_ingest', 'own_data_pick_source', 'own_data_source_next'] as const)(
      'goes silent on %s once a connection is being synced',
      async (stage) => {
        // "Add a source" / "pick a platform" would be actively misleading while the
        // connection they already made is mid-sync.
        mountTarget('new-source-btn');
        mountTarget('source-picker-body');
        mountTarget('wizard-select-next-btn');
        setStage(stage, { path: 'own_data', trackedConnectionId: 'conn-1' });

        render(<InsightWalkthroughCoachmark />);
        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        expect(skipButton()).toBeNull();
      }
    );
  });

  describe('sync holding stages', () => {
    it('points the waiting coachmark at the tracked connection’s own row', async () => {
      // The row has no static selector — it's resolved from the store, because the message is
      // about THIS connection and nothing else on /ingest identifies it.
      mockPathname = '/ingest';
      window.history.pushState({}, '', '/ingest');
      mountTarget('connection-row-conn-1');
      setStage('sync_running', { path: 'own_data', trackedConnectionId: 'conn-1' });

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Your data is syncing'));
    });

    it('falls back to the Ingest nav item while the user is on another page', async () => {
      // A first sync takes minutes and the user is free to wander during it. Pinned to
      // /ingest, this stage showed NOTHING for that whole window — exactly the "walkthrough
      // died" reading it exists to prevent.
      mockPathname = '/orchestrate';
      window.history.pushState({}, '', '/orchestrate');
      mountLink('/ingest');
      setStage('sync_running', { path: 'own_data', trackedConnectionId: 'conn-1' });

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Your data is syncing'));
    });

    it('gives the failure coachmark a Got it that rewinds to the fork’s ingest stage', async () => {
      // Dismissing means "I've read this", not "I've done it": it lands on a stage that is
      // silent while a tracked connection exists, so the message shows exactly once while the
      // walkthrough itself stays live.
      mountLink('/ingest');
      setStage('sync_failed', {
        path: 'automate_pipeline',
        flow: 'automate_pipeline',
        trackedConnectionId: 'conn-1',
        syncFailedRunId: '77',
      });

      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(popoverTitle()).toContain('That sync didn’t finish'));

      const gotIt = document.querySelector('.driver-popover-next-btn') as HTMLElement;
      expect(gotIt.textContent).toBe('Got it');
      await userEvent.click(gotIt);

      expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_ingest');
    });
  });

  describe('transform stages', () => {
    beforeEach(() => {
      mockPathname = '/transform/canvas';
      window.history.pushState({}, '', '/transform/canvas');
    });

    it('moves from naming the table to its Save button once a name is entered', async () => {
      // The stage targets the Output Name input itself, so the coached element IS the input.
      const input = document.createElement('input');
      input.setAttribute('data-testid', 'output-name-input');
      document.body.appendChild(input);
      setStage('pipeline_name_table', { path: 'automate_pipeline', flow: 'automate_pipeline' });
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(popoverTitle()).toContain('Name your table'));

      await userEvent.click(input);
      await userEvent.type(input, 'recovery_drop');
      act(() => input.dispatchEvent(new FocusEvent('blur')));

      await waitFor(() =>
        expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_save_new_table')
      );
    });

    it('coaches the Save button without advancing on the click itself', async () => {
      // The table isn't built when Save is clicked — useCanvasActions advances only once the
      // dispatched run-workflow has actually finished.
      const button = mountTarget('save-table-btn');
      setStage('pipeline_save_new_table', { path: 'automate_pipeline', flow: 'automate_pipeline' });
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(popoverTitle()).toContain('Save table'));

      await userEvent.click(button);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_save_new_table');
    });

    it('coaches the commit message inside the publish dialog', async () => {
      mountTarget('commit-message-input');
      setStage('pipeline_publish_commit', { path: 'automate_pipeline', flow: 'automate_pipeline' });

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Enter a commit message'));
      // Target sits inside an open Radix dialog, whose own backdrop already dims the page —
      // driver.js's overlay would darken the rest of that same dialog.
      expect(document.body.classList.contains('dalgo-tour-passthrough')).toBe(true);
    });

    it('nudges the Orchestrate sidebar item after publishing, from the canvas', async () => {
      // The stage after this one is pinned to /orchestrate and coachmarks never navigate on
      // their own — without a route-less nudge the flow went silent on the canvas.
      const link = mountLink('/orchestrate');
      setStage('pipeline_orchestrate_nudge', {
        path: 'automate_pipeline',
        flow: 'automate_pipeline',
      });

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Create a data pipeline'));
      expect(link.classList.contains('dalgo-tour-ring')).toBe(true);
      expect(document.querySelector('.dalgo-tour-stage-image')).not.toBeNull();
    });

    it('advances the Orchestrate nudge once the user actually gets there', async () => {
      mountLink('/orchestrate');
      mountTarget('create-pipeline-btn');
      setStage('pipeline_orchestrate_nudge', {
        path: 'automate_pipeline',
        flow: 'automate_pipeline',
      });
      const { rerender } = render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(popoverTitle()).toContain('Create a data pipeline'));

      mockPathname = '/orchestrate';
      window.history.pushState({}, '', '/orchestrate');
      rerender(<InsightWalkthroughCoachmark />);

      await waitFor(() =>
        expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_orchestrate_intro')
      );
    });
  });

  describe('when the target goes away', () => {
    it('rewinds to the stage that reopens the dialog instead of marching forward', async () => {
      // Stage is inside the KPI dialog, but no dialog is on screen — the user cancelled it.
      mountTarget('create-kpi-btn');
      setStage('kpi_direction');
      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_intro'), {
        timeout: 5000,
      });
      expect(useInsightWalkthroughStore.getState().active).toBe(true);
      await waitFor(() => expect(popoverTitle()).toContain('Track your targets'));
    });
  });
});
