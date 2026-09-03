import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import { InsightWalkthroughCoachmark } from '../insight-walkthrough-coachmark';
import type { WalkthroughStage } from '../insight-walkthrough-constants';

let mockPathname = '/kpis';

// Creating a dashboard redirects off /dashboards/create straight to the builder, so the builder
// stages are only ever shown under this URL shape.
const BUILDER_PATHNAME = '/dashboards/7/edit';
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

/** The "Leave the walkthrough?" prompt now standing between every exit and the skip. */
function leavePrompt(): HTMLElement | null {
  return document.querySelector('[data-testid="leave-walkthrough-dialog"]');
}

/** Clicks the ✕ and confirms the prompt it raises — the full exit a user goes through. */
async function skipThroughPrompt(): Promise<void> {
  await userEvent.click(skipButton()!);
  await waitFor(() => expect(leavePrompt()).not.toBeNull());
  await userEvent.click(
    document.querySelector('[data-testid="leave-walkthrough-skip-btn"]') as HTMLElement
  );
}

function popoverTitle(): string {
  return document.querySelector('.driver-popover-title')?.textContent ?? '';
}

function popoverDescription(): string {
  return document.querySelector('.driver-popover-description')?.textContent ?? '';
}

/**
 * How dark the page is behind the coachmark. driver.js renders its overlay as an <svg> whose
 * <path> carries the configured `overlayOpacity` inline, so the path's style is the only place
 * the setting is observable — '0' meaning no dim at all.
 *
 * Returns '' until the overlay exists: driver.js builds it on its first animation frame (the
 * popover lands synchronously, the overlay does not), so read this through `waitFor`.
 */
function overlayOpacity(): string {
  const path = document.querySelector('.driver-overlay path') as SVGPathElement | null;
  return path?.style.opacity ?? '';
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
    useSidebarStore.setState({ collapsed: false, expandedMenus: {}, parentMenuByHref: {} });
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
      expect(skipButton()!.parentElement).toBe(
        document.querySelector('.driver-popover-title')?.parentElement
      );
      expect(skipButton()!.parentElement).toHaveClass(
        'dalgo-tour-heading-row',
        'dalgo-tour-heading-row--coachmark'
      );
    });

    it('ends the whole walkthrough once the ✕ is confirmed', async () => {
      mountTarget('create-kpi-btn');
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await skipThroughPrompt();

      expect(useInsightWalkthroughStore.getState().active).toBe(false);
    });

    it('leaves the walkthrough running when the ✕ is not confirmed', async () => {
      mountTarget('create-kpi-btn');
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(skipButton()!);
      await waitFor(() => expect(leavePrompt()).not.toBeNull());
      await userEvent.click(
        document.querySelector('[data-testid="leave-walkthrough-continue-btn"]') as HTMLElement
      );

      await waitFor(() => expect(leavePrompt()).toBeNull());
      expect(useInsightWalkthroughStore.getState().active).toBe(true);
      expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_intro');
      // The coachmark is still up — Continue dismisses the prompt, nothing else.
      expect(skipButton()).not.toBeNull();
    });

    it('asks before a click outside the stage takes the user out of the flow', async () => {
      mountTarget('create-kpi-btn');
      const elsewhere = document.createElement('button');
      document.body.appendChild(elsewhere);
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(elsewhere);

      await waitFor(() => expect(leavePrompt()).not.toBeNull());
      expect(useInsightWalkthroughStore.getState().active).toBe(true);
    });

    it('holds a list page to the coached CTA, so another card cannot take over the flow', async () => {
      // The reported break: with "click Create KPI" on screen, clicking any KPI card opened its
      // detail drawer and the walkthrough was left pointing at a button behind it.
      const content = document.createElement('main');
      content.id = 'main-layout-main-content';
      document.body.appendChild(content);
      const target = document.createElement('div');
      target.setAttribute('data-testid', 'create-kpi-btn');
      content.appendChild(target);
      const card = document.createElement('button');
      const onCardClick = jest.fn();
      card.addEventListener('click', onCardClick);
      content.appendChild(card);

      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(card);

      await waitFor(() => expect(leavePrompt()).not.toBeNull());
      expect(onCardClick).not.toHaveBeenCalled();
    });

    it('guards Cancel on the dialog the coachmark points into, but not its other fields', async () => {
      // The reported break: with "Pick a metric" on the KPI wizard, Cancel and ✕ were still
      // live, so one click could close the flow's own dialog with no confirmation. The fields
      // beside them stay usable — a wizard step can't be finished otherwise.
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      document.body.appendChild(dialog);
      const target = document.createElement('div');
      target.setAttribute('data-testid', 'kpi-form-metric-field');
      dialog.appendChild(target);
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      const onCancelClick = jest.fn();
      cancel.addEventListener('click', onCancelClick);
      dialog.appendChild(cancel);
      const otherField = document.createElement('input');
      const onFieldClick = jest.fn();
      otherField.addEventListener('click', onFieldClick);
      dialog.appendChild(otherField);
      setStage('kpi_metric');

      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(otherField);
      expect(leavePrompt()).toBeNull();
      expect(onFieldClick).toHaveBeenCalledTimes(1);

      await userEvent.click(cancel);

      await waitFor(() => expect(leavePrompt()).not.toBeNull());
      expect(onCancelClick).not.toHaveBeenCalled();
    });

    it('guards the page a route-less nudge appears on, same as any other stage', async () => {
      const content = document.createElement('main');
      content.id = 'main-layout-main-content';
      document.body.appendChild(content);
      const unrelated = document.createElement('button');
      const onUnrelatedClick = jest.fn();
      unrelated.addEventListener('click', onUnrelatedClick);
      content.appendChild(unrelated);
      mountLink('/charts');
      setStage('chart_intro', { path: 'own_data' });

      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(unrelated);

      await waitFor(() => expect(leavePrompt()).not.toBeNull());
      expect(onUnrelatedClick).not.toHaveBeenCalled();
    });

    it('lets the coached click open a dialog and keeps that dialog usable', async () => {
      // builder_add_chart rings Add Chart; the picker it opens has no stage of its own, so its
      // rows must stay clickable or the step dead-ends.
      mockPathname = BUILDER_PATHNAME;
      window.history.pushState({}, '', BUILDER_PATHNAME);
      mountTarget('add-chart-btn');
      const picker = document.createElement('div');
      picker.setAttribute('role', 'dialog');
      document.body.appendChild(picker);
      const row = document.createElement('button');
      const onRowClick = jest.fn();
      row.addEventListener('click', onRowClick);
      picker.appendChild(row);
      setStage('builder_add_chart');

      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(row);

      expect(leavePrompt()).toBeNull();
      expect(onRowClick).toHaveBeenCalledTimes(1);
    });

    it('keeps a required field no stage coaches clickable', async () => {
      // KPI step 2 asks for a name, and every stage there points at a different control — so
      // without this the user hits "KPI name is required" with no way to fix it.
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      document.body.appendChild(dialog);
      const input = document.createElement('input');
      mountTarget('kpi-form-target-field', input);
      dialog.appendChild(document.querySelector('[data-testid="kpi-form-target-field"]')!);
      const nameField = document.createElement('input');
      nameField.id = 'kpi-name';
      const onNameClick = jest.fn();
      nameField.addEventListener('click', onNameClick);
      dialog.appendChild(nameField);
      setStage('kpi_target');

      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(nameField);

      expect(leavePrompt()).toBeNull();
      expect(onNameClick).toHaveBeenCalledTimes(1);
    });

    it('guards the add-source wizard even on the steps that have no coachmark', async () => {
      // The configure and connection steps carry no stage on purpose, so the coachmark goes
      // quiet — but ✕ / Cancel / Back there still abandon a live walkthrough mid-source.
      const wizard = document.createElement('div');
      wizard.setAttribute('role', 'dialog');
      wizard.setAttribute('data-testid', 'add-source-wizard');
      document.body.appendChild(wizard);
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      const onCancelClick = jest.fn();
      cancel.addEventListener('click', onCancelClick);
      wizard.appendChild(cancel);
      const field = document.createElement('input');
      const onFieldClick = jest.fn();
      field.addEventListener('click', onFieldClick);
      wizard.appendChild(field);
      // A stage whose target is never mounted: nothing is painted, so the coachmark itself is
      // not what arms the guard here.
      setStage('own_data_source_next', { path: 'own_data' });
      mockPathname = '/ingest';
      window.history.pushState({}, '', '/ingest');

      render(<InsightWalkthroughCoachmark />);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(skipButton()).toBeNull();

      // The wizard's own fields stay usable.
      await userEvent.click(field);
      expect(leavePrompt()).toBeNull();
      expect(onFieldClick).toHaveBeenCalledTimes(1);

      await userEvent.click(cancel);

      await waitFor(() => expect(leavePrompt()).not.toBeNull());
      expect(onCancelClick).not.toHaveBeenCalled();
    });

    it('leaves the app alone when no coachmark is up and no protected modal is open', async () => {
      const elsewhere = document.createElement('button');
      const onElsewhereClick = jest.fn();
      elsewhere.addEventListener('click', onElsewhereClick);
      document.body.appendChild(elsewhere);
      setStage('own_data_source_next', { path: 'own_data' });

      render(<InsightWalkthroughCoachmark />);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      await userEvent.click(elsewhere);

      expect(leavePrompt()).toBeNull();
      expect(onElsewhereClick).toHaveBeenCalledTimes(1);
    });

    it('lets the user roam while a sync runs, but still asks on the ✕', async () => {
      // The sync takes minutes and the stage asks for nothing, so the app stays usable — but
      // closing the coachmark is still leaving the walkthrough.
      mockPathname = '/ingest';
      window.history.pushState({}, '', '/ingest');
      mountTarget('sync-btn-conn-1');
      const elsewhere = document.createElement('button');
      const onElsewhereClick = jest.fn();
      elsewhere.addEventListener('click', onElsewhereClick);
      document.body.appendChild(elsewhere);
      setStage('sync_running', { path: 'own_data', trackedConnectionId: 'conn-1' });

      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(popoverTitle()).toContain('Your data is syncing'));

      await userEvent.click(elsewhere);
      expect(leavePrompt()).toBeNull();
      expect(onElsewhereClick).toHaveBeenCalledTimes(1);

      await userEvent.click(skipButton()!);

      await waitFor(() => expect(leavePrompt()).not.toBeNull());
      expect(useInsightWalkthroughStore.getState().active).toBe(true);
    });

    it('keeps the schedule fields a frequency reveals clickable', async () => {
      // Picking Weekly renders Days of the Week and Time of Day as SIBLINGS of the coached
      // cron-container, both required — so the stage asks for a frequency and then blocked the
      // only way to finish setting one.
      mockPathname = '/orchestrate/create';
      window.history.pushState({}, '', '/orchestrate/create');
      mountTarget('cron-container');
      const days = mountTarget('cron-days-of-week-container');
      const onDaysClick = jest.fn();
      days.addEventListener('click', onDaysClick);
      const time = mountTarget('cron-time-of-day-container');
      const onTimeClick = jest.fn();
      time.addEventListener('click', onTimeClick);
      setStage('pipeline_set_schedule', { path: 'automate_pipeline', flow: 'automate_pipeline' });

      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(days);
      await userEvent.click(time);

      expect(leavePrompt()).toBeNull();
      expect(onDaysClick).toHaveBeenCalledTimes(1);
      expect(onTimeClick).toHaveBeenCalledTimes(1);
    });

    it('leaves the whole chart builder free, chrome aside', async () => {
      // A chart is shaped to the user's own data: the config panels, the Data / Raw tabs and the
      // chart's name all have to stay usable while a stage points at one tab.
      mockPathname = '/charts/new/configure';
      window.history.pushState({}, '', '/charts/new/configure');
      const content = document.createElement('main');
      content.id = 'main-layout-main-content';
      document.body.appendChild(content);
      const tab = document.createElement('div');
      tab.setAttribute('data-testid', 'chart-data-config-tab');
      content.appendChild(tab);
      const rawTab = document.createElement('button');
      const onRawClick = jest.fn();
      rawTab.addEventListener('click', onRawClick);
      content.appendChild(rawTab);
      const nameInput = document.createElement('input');
      const onNameClick = jest.fn();
      nameInput.addEventListener('click', onNameClick);
      content.appendChild(nameInput);
      // Chrome lives outside the content region and stays guarded.
      const sidebarLink = document.createElement('a');
      sidebarLink.setAttribute('href', '/dashboards');
      document.body.appendChild(sidebarLink);
      setStage('chart_data_config', { path: 'own_data' });

      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(rawTab);
      await userEvent.click(nameInput);
      expect(leavePrompt()).toBeNull();
      expect(onRawClick).toHaveBeenCalledTimes(1);
      expect(onNameClick).toHaveBeenCalledTimes(1);

      await userEvent.click(sidebarLink);

      await waitFor(() => expect(leavePrompt()).not.toBeNull());
    });

    it('lets filters be applied on the saved dashboard, but nothing else', async () => {
      // The share stage asks for one click, and filters are the other thing a freshly built
      // dashboard invites — everything else on that page still asks first.
      mockPathname = '/dashboards/7';
      window.history.pushState({}, '', '/dashboards/7');
      mountTarget('dashboard-share-btn');
      const filters = mountTarget('dashboard-filters-panel');
      const onFilterClick = jest.fn();
      filters.addEventListener('click', onFilterClick);
      const somethingElse = document.createElement('button');
      const onOtherClick = jest.fn();
      somethingElse.addEventListener('click', onOtherClick);
      document.body.appendChild(somethingElse);
      setStage('share', { path: 'own_data' });

      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(filters);
      expect(leavePrompt()).toBeNull();
      expect(onFilterClick).toHaveBeenCalledTimes(1);

      await userEvent.click(somethingElse);

      await waitFor(() => expect(leavePrompt()).not.toBeNull());
      expect(onOtherClick).not.toHaveBeenCalled();
    });

    it('lets the stage’s own target through without asking', async () => {
      const target = mountTarget('create-kpi-btn');
      render(<InsightWalkthroughCoachmark />);
      await waitFor(() => expect(skipButton()).not.toBeNull());

      await userEvent.click(target);

      expect(leavePrompt()).toBeNull();
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

      await skipThroughPrompt();

      await waitFor(() => expect(target.classList.contains('dalgo-tour-ring')).toBe(false));
    });
  });

  describe('the dim overlay', () => {
    it('greys the page out behind a sidebar hand-off', async () => {
      // These stages say "stop what you're doing and go here", so the nav item they cut out is
      // the only lit thing left on screen.
      mountLink('/orchestrate');
      setStage('pipeline_orchestrate_nudge', {
        path: 'automate_pipeline',
        flow: 'automate_pipeline',
      });
      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(overlayOpacity()).toBe('0.55'));
    });

    it('leaves an in-page stage undimmed', async () => {
      // The user is working IN this page — greying it would fight the step. The ring on the CTA
      // plus the popover is the whole highlight here.
      mountTarget('create-kpi-btn');
      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(overlayOpacity()).toBe('0'));
    });
  });

  describe('coachmark guidance', () => {
    it('makes clear that users may choose any metric', async () => {
      mountTarget('kpi-form-metric-field');
      setStage('kpi_metric');
      render(<InsightWalkthroughCoachmark />);

      await waitFor(() =>
        expect(popoverDescription()).toBe(
          'The measure this KPI tracks, for example a count of beneficiaries. Choose any metric to get started.'
        )
      );
    });

    it('uses concise, single-line copy for the dashboard Preview guide', async () => {
      mockPathname = BUILDER_PATHNAME;
      window.history.pushState({}, '', BUILDER_PATHNAME);
      mountTarget('dashboard-preview-btn');
      setStage('builder_preview');
      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toBe('Preview it first'));
      expect(popoverDescription()).toBe('See what your team will see.');
      expect(document.querySelector('.driver-popover-description')).toHaveClass(
        'dalgo-tour-description-one-line'
      );
    });

    it('labels the own-data dashboard step as sample KPIs', async () => {
      mockPathname = BUILDER_PATHNAME;
      window.history.pushState({}, '', BUILDER_PATHNAME);
      mountTarget('add-kpi-btn');
      setStage('builder_add_kpi_second', { path: 'own_data' });
      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toBe('Add sample KPIs'));
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

    it('highlights Continue after a chart type is selected', async () => {
      mockPathname = '/charts/new';
      window.history.pushState({}, '', '/charts/new');
      mountTarget('chart-type-continue-button');
      setStage('chart_continue', { path: 'own_data' });
      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toBe('Continue to configure your chart'));
      expect(document.querySelector('.driver-active-element')).toHaveAttribute(
        'data-testid',
        'chart-type-continue-button'
      );
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

      // Step 1's Continue, not the target field — that one only exists on step 2.
      await waitFor(() =>
        expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_step1_continue')
      );
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
    // The General access picker, not the old on/off switch: resource sharing replaced the
    // is_public toggle with a Private/Everyone/Public select.
    it('coaches the General access picker on a saved dashboard', async () => {
      mockPathname = '/dashboards/12';
      window.history.pushState({}, '', '/dashboards/12');
      mountTarget('general-access-select');
      setStage('share_public_toggle');

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Turn on public access'));
      // Choosing Public is what advances it (dashboard-native-view's onMadePublic handler),
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

      await waitFor(() => expect(popoverTitle()).toContain('Pick a data source'));
      // Selecting a source is what advances it (SelectSourceStep's own handler, which sees
      // both cards and search results), so the coachmark itself must not move on a click.
      expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_pick_source');
    });

    it('continues the popover outline around its pointer triangle', async () => {
      mountTarget('source-picker-body');
      setStage('own_data_pick_source', { path: 'own_data' });

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Pick a data source'));
      expect(document.querySelector('.driver-popover')).toHaveClass('dalgo-tour-arrow-outlined');
    });

    it.each([
      ['own_data', 'own_data_source_next'],
      ['automate_pipeline', 'pipeline_source_next'],
    ] as const)('coaches the wizard’s Next button on the %s fork', async (path, stage) => {
      mountTarget('wizard-select-next-btn');
      setStage(stage, { path });

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Now set it up'));
      expect(popoverDescription()).toBe(
        'Click Next to provide the credentials required to connect to the data source.'
      );
      // A steer, not a gate — the fork rejoins on the tracked connection's first sync
      // (see tour-gate.tsx), not on this click.
      expect(useInsightWalkthroughStore.getState().stage).toBe(stage);
    });

    it.each(['own_data_ingest', 'own_data_pick_source', 'own_data_source_next'] as const)(
      'goes silent on %s once a connection is being synced',
      async (stage) => {
        // "Add a source" / "pick a data source" would be actively misleading while the
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
    it('points the waiting coachmark at the tracked connection’s sync button', async () => {
      // The button, not the row: a row-wide target parks the popover in the middle of the
      // connection pointing at nothing, while the spinner in the Actions cell is the thing
      // actually syncing. No static selector — the id is resolved from the store, because
      // nothing else on /ingest says WHICH connection this is about.
      mockPathname = '/ingest';
      window.history.pushState({}, '', '/ingest');
      mountTarget('sync-btn-conn-1');
      setStage('sync_running', { path: 'own_data', trackedConnectionId: 'conn-1' });

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Your data is syncing'));
    });

    it('also finds the button while the sync is queued', async () => {
      // The Actions cell swaps sync-btn for cancel-sync while a run is queued. Matching only
      // sync-btn would leave this stage silently pointing at nothing for that window.
      mockPathname = '/ingest';
      window.history.pushState({}, '', '/ingest');
      mountTarget('cancel-sync-conn-1');
      setStage('sync_running', { path: 'own_data', trackedConnectionId: 'conn-1' });

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Your data is syncing'));
    });

    it('stays silent while the user is on another page', async () => {
      // A first sync takes minutes and the user is free to explore. This stage asks nothing of
      // them, so following them around every route is just nagging — it used to retarget the
      // Ingest nav item. Sync completion moves them on from wherever they are, so nothing is
      // lost by going quiet here.
      mockPathname = '/orchestrate';
      window.history.pushState({}, '', '/orchestrate');
      // Both former and current targets are present in the DOM, so the ONLY thing keeping the
      // popover away is the route check — not a missing element.
      mountLink('/ingest');
      mountTarget('sync-btn-conn-1');
      setStage('sync_running', { path: 'own_data', trackedConnectionId: 'conn-1' });

      render(<InsightWalkthroughCoachmark />);
      // Settle rather than waitFor: an empty title satisfies waitFor on its first tick, so it
      // would pass whether or not the popover was about to appear.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(popoverTitle()).toBe('');
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

  describe('sidebar-anchored stages', () => {
    // Every one of these fires at a hand-off, and by then the user is standing on a page that
    // collapsed the sidebar to the icon rail on arrival. Nothing else ever expands it again.
    it('opens the collapsed sidebar and the Data submenu for the Transform nudge', async () => {
      mockPathname = '/transform/canvas';
      window.history.pushState({}, '', '/transform/canvas');
      useSidebarStore.setState({ collapsed: true, parentMenuByHref: { '/transform': 'Data' } });
      mountLink('/transform');
      setStage('pipeline_transform_intro', {
        path: 'automate_pipeline',
        flow: 'automate_pipeline',
      });

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(useSidebarStore.getState().collapsed).toBe(false));
      expect(useSidebarStore.getState().expandedMenus.Data).toBe(true);
    });

    it('opens the collapsed sidebar for the Orchestrate nudge', async () => {
      mockPathname = '/transform/canvas';
      window.history.pushState({}, '', '/transform/canvas');
      useSidebarStore.setState({ collapsed: true, parentMenuByHref: { '/orchestrate': 'Data' } });
      mountLink('/orchestrate');
      setStage('pipeline_orchestrate_nudge', {
        path: 'automate_pipeline',
        flow: 'automate_pipeline',
      });

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(useSidebarStore.getState().collapsed).toBe(false));
      expect(useSidebarStore.getState().expandedMenus.Data).toBe(true);
    });

    it('leaves the sidebar alone for a stage anchored inside the page', async () => {
      // Only the nav-item stages touch it: a builder or canvas step wants the width, and
      // opening the menu under someone mid-edit would be the walkthrough moving their layout.
      useSidebarStore.setState({ collapsed: true });
      mountTarget('create-kpi-btn');
      setStage('kpi_intro');

      render(<InsightWalkthroughCoachmark />);

      await waitFor(() => expect(popoverTitle()).toContain('Track your targets'));
      expect(useSidebarStore.getState().collapsed).toBe(true);
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
