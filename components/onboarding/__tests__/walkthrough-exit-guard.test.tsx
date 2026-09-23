/**
 * The click guard that keeps a running walkthrough on rails — what it lets through, what it
 * turns into a "leave the walkthrough?" prompt, and (the part that matters most) what it must
 * NEVER block, since a blocked click the user needs is a dead end they can only skip out of.
 */
import React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  isClickAllowedDuringWalkthrough,
  useWalkthroughExitGuard,
} from '../walkthrough-exit-guard';

function el(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html.trim();
  const node = host.firstElementChild as HTMLElement;
  document.body.appendChild(node);
  return node;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('isClickAllowedDuringWalkthrough', () => {
  it('allows the stage’s own target and anything inside it', () => {
    const target = el('<button><span>label</span></button>');

    expect(isClickAllowedDuringWalkthrough(target, [target])).toBe(true);
    expect(isClickAllowedDuringWalkthrough(target.firstElementChild, [target])).toBe(true);
  });

  it('guards an element outside every allowed root', () => {
    const target = el('<button>target</button>');
    const elsewhere = el('<a href="/charts">Charts</a>');

    expect(isClickAllowedDuringWalkthrough(elsewhere, [target])).toBe(false);
  });

  it('allows the coachmark card itself', () => {
    const popover = el('<div class="driver-popover"><button>Next</button></div>');

    expect(isClickAllowedDuringWalkthrough(popover.firstElementChild, [])).toBe(true);
  });

  it('allows portaled dropdown content, which sits outside the field it belongs to', () => {
    // Radix renders combobox/select lists at the end of <body>, so a stage pointing at a
    // dropdown can't reach its own options any other way.
    const option = el('<div data-radix-popper-content-wrapper=""><div>Option</div></div>');

    expect(isClickAllowedDuringWalkthrough(option.firstElementChild, [])).toBe(true);
  });

  it('allows the Get Started widget, the one control the prompt tells users to use', () => {
    const pill = el('<button data-testid="getting-started-widget-pill">Get Started</button>');

    expect(isClickAllowedDuringWalkthrough(pill, [])).toBe(true);
  });

  it('lets the user work inside the modal the coachmark points into', () => {
    // A wizard step is a set of choices the walkthrough can't coach one at a time, and the step
    // can't be finished without them.
    const dialog = el(`
      <div role="dialog">
        <input data-testid="coached-field" />
        <button data-testid="option-b">Option B</button>
      </div>
    `);
    const coached = dialog.querySelector('[data-testid="coached-field"]');

    expect(
      isClickAllowedDuringWalkthrough(dialog.querySelector('[data-testid="option-b"]'), [coached])
    ).toBe(true);
  });

  it('guards the controls that walk out of that modal', () => {
    const dialog = el(`
      <div role="dialog">
        <input data-testid="coached-field" />
        <button data-slot="dialog-close" aria-label="Close">✕</button>
        <button data-testid="wizard-cancel-btn">Cancel</button>
        <button>Cancel</button>
      </div>
    `);
    const coached = dialog.querySelector('[data-testid="coached-field"]');
    const guarded = ['[data-slot="dialog-close"]', '[data-testid="wizard-cancel-btn"]'];

    for (const selector of guarded) {
      expect(isClickAllowedDuringWalkthrough(dialog.querySelector(selector), [coached])).toBe(
        false
      );
    }
    // The bare Cancel carries no slot or testid — matched on its label alone.
    const bareCancel = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancel' && !b.dataset.testid
    );
    expect(isClickAllowedDuringWalkthrough(bareCancel, [coached])).toBe(false);
  });

  it('guards a wizard’s exits even with no coached target, when a protected modal armed it', () => {
    // The add-source wizard's configure/connection steps carry no stage, so there is no coached
    // target to compare against — that modal is still the flow.
    const dialog = el(`
      <div role="dialog" data-testid="add-source-wizard">
        <input data-testid="credential" />
        <button data-testid="wizard-cancel-btn">Cancel</button>
      </div>
    `);

    expect(
      isClickAllowedDuringWalkthrough(dialog.querySelector('[data-testid="credential"]'), [])
    ).toBe(true);
    expect(
      isClickAllowedDuringWalkthrough(dialog.querySelector('[data-testid="wizard-cancel-btn"]'), [])
    ).toBe(false);
  });

  it('does not mistake a longer label for an exit control', () => {
    const dialog = el(`
      <div role="dialog">
        <input data-testid="coached-field" />
        <button data-testid="option">Back to monthly totals</button>
      </div>
    `);
    const coached = dialog.querySelector('[data-testid="coached-field"]');

    expect(
      isClickAllowedDuringWalkthrough(dialog.querySelector('[data-testid="option"]'), [coached])
    ).toBe(true);
  });

  it('lets the user work anywhere inside the transform operation panel', () => {
    // Picking an operation, ticking columns, Select All, the search box — none of it is the
    // coached target, and all of it is needed to reach the Save the stage waits for.
    const panel = el(`
      <div data-testid="operation-config-layout">
        <div data-testid="operation-dropcolumns">Drop</div>
        <input data-testid="drop-search" />
        <button data-testid="select-all">SELECT ALL</button>
        <input type="checkbox" data-testid="column-province" />
        <button data-testid="panel-back-btn" aria-label="Go back">back</button>
        <button data-testid="save-table-btn">Save</button>
      </div>
    `);
    const coached = panel.querySelector('[data-testid="operation-dropcolumns"]');
    const allowed = [
      '[data-testid="drop-search"]',
      '[data-testid="select-all"]',
      '[data-testid="column-province"]',
      '[data-testid="save-table-btn"]',
      // Going back to the operation list to pick a different function is working in the panel.
      '[data-testid="panel-back-btn"]',
    ];

    for (const selector of allowed) {
      expect(isClickAllowedDuringWalkthrough(panel.querySelector(selector), [coached])).toBe(true);
    }
  });

  it('guards the operation panel’s ✕, which abandons the step', () => {
    const panel = el(`
      <div data-testid="operation-config-layout">
        <div data-testid="operation-dropcolumns">Drop</div>
        <button data-testid="panel-close-btn" aria-label="Close panel">x</button>
      </div>
    `);
    const coached = panel.querySelector('[data-testid="operation-dropcolumns"]');

    expect(
      isClickAllowedDuringWalkthrough(panel.querySelector('[data-testid="panel-close-btn"]'), [
        coached,
      ])
    ).toBe(false);
  });

  it('lets the user step BACK inside the wizard the coachmark points into', () => {
    // Back moves to an earlier step of the same flow, where that step's coachmark is waiting.
    // Only Cancel and ✕ abandon the thing being asked for.
    const dialog = el(`
      <div role="dialog">
        <input data-testid="coached-field" />
        <button data-testid="kpi-form-back-btn">Back</button>
        <button data-testid="kpi-form-cancel-btn">Cancel</button>
      </div>
    `);
    const coached = dialog.querySelector('[data-testid="coached-field"]');

    expect(
      isClickAllowedDuringWalkthrough(dialog.querySelector('[data-testid="kpi-form-back-btn"]'), [
        coached,
      ])
    ).toBe(true);
    expect(
      isClickAllowedDuringWalkthrough(dialog.querySelector('[data-testid="kpi-form-cancel-btn"]'), [
        coached,
      ])
    ).toBe(false);
  });

  it('guards a page-roam stage’s own exits, inside the region it opened up', () => {
    // The dashboard builder: everything in the page is the step, except the way out of it.
    const content = el('<main id="main-layout-main-content"></main>');
    const tile = document.createElement('div');
    content.appendChild(tile);
    const back = document.createElement('button');
    back.setAttribute('data-testid', 'dashboard-back-btn');
    content.appendChild(back);
    const exits = ['[data-testid="dashboard-back-btn"]'];

    expect(isClickAllowedDuringWalkthrough(tile, [null, null, content], exits)).toBe(true);
    expect(isClickAllowedDuringWalkthrough(back, [null, null, content], exits)).toBe(false);
  });

  it('allows a dialog the coached click just opened, which no stage covers', () => {
    // Add Chart's chart picker, the save-chart name dialog: the coached target is the button
    // BEHIND them, and nothing inside is coached at all.
    const pageButton = el('<button data-testid="add-chart-btn">Add chart</button>');
    const picker = el('<div role="dialog"><button data-testid="chart-row">A chart</button></div>');

    expect(
      isClickAllowedDuringWalkthrough(picker.querySelector('[data-testid="chart-row"]'), [
        pageButton,
      ])
    ).toBe(true);
  });

  it('allows any click while a dropdown is open, so it can be dismissed', () => {
    // The multi-selects stay open after a pick and only close on a click outside them.
    el('<div data-radix-popper-content-wrapper=""><div data-state="open">list</div></div>');
    const elsewhere = el('<button>elsewhere</button>');

    expect(isClickAllowedDuringWalkthrough(elsewhere, [])).toBe(true);
  });

  it('treats an unjudgeable click as allowed rather than prompting', () => {
    const detached = document.createElement('button');

    expect(isClickAllowedDuringWalkthrough(detached, [])).toBe(true);
    expect(isClickAllowedDuringWalkthrough(null, [])).toBe(true);
  });
});

describe('useWalkthroughExitGuard', () => {
  function Harness({
    armed,
    roots,
    onLeaveIntent,
  }: {
    armed: boolean;
    roots: () => Element[];
    onLeaveIntent: () => void;
  }): null {
    useWalkthroughExitGuard({
      isArmed: () => armed,
      getAllowedRoots: roots,
      onLeaveIntent,
    });
    return null;
  }

  it('cancels a guarded click and raises the prompt exactly once', async () => {
    const target = el('<button>target</button>');
    const elsewhere = el('<button>elsewhere</button>');
    const onElsewhereClick = jest.fn();
    elsewhere.addEventListener('click', onElsewhereClick);
    const onLeaveIntent = jest.fn();

    render(<Harness armed roots={() => [target]} onLeaveIntent={onLeaveIntent} />);
    await userEvent.click(elsewhere);

    expect(onLeaveIntent).toHaveBeenCalledTimes(1);
    // The click never reaches the app: cancelling pointerdown alone would still let the
    // element's own click handler run.
    expect(onElsewhereClick).not.toHaveBeenCalled();
  });

  it('leaves an allowed click completely alone', async () => {
    const target = el('<button>target</button>');
    const onTargetClick = jest.fn();
    target.addEventListener('click', onTargetClick);
    const onLeaveIntent = jest.fn();

    render(<Harness armed roots={() => [target]} onLeaveIntent={onLeaveIntent} />);
    await userEvent.click(target);

    expect(onTargetClick).toHaveBeenCalledTimes(1);
    expect(onLeaveIntent).not.toHaveBeenCalled();
  });

  it('does nothing while disarmed', async () => {
    const elsewhere = el('<button>elsewhere</button>');
    const onElsewhereClick = jest.fn();
    elsewhere.addEventListener('click', onElsewhereClick);
    const onLeaveIntent = jest.fn();

    render(<Harness armed={false} roots={() => []} onLeaveIntent={onLeaveIntent} />);
    await userEvent.click(elsewhere);

    expect(onLeaveIntent).not.toHaveBeenCalled();
    expect(onElsewhereClick).toHaveBeenCalledTimes(1);
  });

  it('ignores a right-click, which has no app action to intercept', async () => {
    const elsewhere = el('<button>elsewhere</button>');
    const onLeaveIntent = jest.fn();

    render(<Harness armed roots={() => []} onLeaveIntent={onLeaveIntent} />);
    await userEvent.pointer({ target: elsewhere, keys: '[MouseRight]' });

    expect(onLeaveIntent).not.toHaveBeenCalled();
  });
});
