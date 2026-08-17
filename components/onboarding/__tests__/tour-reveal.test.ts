import { revealElementInScrollParents, REVEAL_MARGIN_PX } from '../tour-reveal';

/**
 * jsdom has no layout: every rect is 0x0 and `scrollHeight` is always 0. Each test therefore
 * describes the geometry it needs directly — a scroller box, and where the target sits
 * relative to it — and asserts on the scrollTop the reveal writes back.
 */
function stubRect(el: HTMLElement, rect: Partial<DOMRect>): void {
  el.getBoundingClientRect = () =>
    ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, ...rect }) as DOMRect;
}

function makeScroller({
  scrollable,
  top,
  bottom,
}: {
  scrollable: boolean;
  top: number;
  bottom: number;
}): HTMLElement {
  const scroller = document.createElement('div');
  scroller.style.overflowY = scrollable ? 'auto' : 'visible';
  Object.defineProperty(scroller, 'clientHeight', { value: bottom - top, configurable: true });
  Object.defineProperty(scroller, 'scrollHeight', {
    value: scrollable ? (bottom - top) * 3 : bottom - top,
    configurable: true,
  });
  stubRect(scroller, { top, bottom, left: 0, right: 240, width: 240, height: bottom - top });
  document.body.appendChild(scroller);
  return scroller;
}

describe('revealElementInScrollParents', () => {
  let scrollBySpy: jest.SpyInstance;

  beforeEach(() => {
    document.body.innerHTML = '';
    scrollBySpy = jest.spyOn(window, 'scrollBy').mockImplementation(() => {});
  });

  afterEach(() => {
    scrollBySpy.mockRestore();
  });

  it('scrolls the sidebar nav down when the target sits below its fold', () => {
    // The zoomed-laptop case: nav viewport ends at 640, the "Settings" link runs 660-700.
    const scroller = makeScroller({ scrollable: true, top: 100, bottom: 640 });
    const target = document.createElement('a');
    stubRect(target, { top: 660, bottom: 700, left: 0, right: 240 });
    scroller.appendChild(target);

    revealElementInScrollParents(target);

    expect(scroller.scrollTop).toBe(700 - (640 - REVEAL_MARGIN_PX));
  });

  it('scrolls the sidebar nav up when the target sits above its fold', () => {
    const scroller = makeScroller({ scrollable: true, top: 100, bottom: 640 });
    const target = document.createElement('a');
    stubRect(target, { top: 60, bottom: 100, left: 0, right: 240 });
    scroller.appendChild(target);

    revealElementInScrollParents(target);

    expect(scroller.scrollTop).toBe(60 - (100 + REVEAL_MARGIN_PX));
  });

  it('leaves a target that already fits alone', () => {
    const scroller = makeScroller({ scrollable: true, top: 100, bottom: 640 });
    const target = document.createElement('a');
    stubRect(target, { top: 200, bottom: 240, left: 0, right: 240 });
    scroller.appendChild(target);

    revealElementInScrollParents(target);

    expect(scroller.scrollTop).toBe(0);
    expect(scrollBySpy).not.toHaveBeenCalled();
  });

  it('ignores an ancestor that cannot scroll', () => {
    const scroller = makeScroller({ scrollable: false, top: 100, bottom: 640 });
    const target = document.createElement('a');
    stubRect(target, { top: 660, bottom: 700, left: 0, right: 240 });
    scroller.appendChild(target);

    revealElementInScrollParents(target);

    expect(scroller.scrollTop).toBe(0);
  });

  it('falls back to scrolling the page when nothing between clips the target', () => {
    const target = document.createElement('button');
    stubRect(target, { top: 900, bottom: 940, left: 0, right: 200 });
    document.body.appendChild(target);

    revealElementInScrollParents(target);

    expect(scrollBySpy).toHaveBeenCalledWith(0, 940 - (window.innerHeight - REVEAL_MARGIN_PX));
  });
});
