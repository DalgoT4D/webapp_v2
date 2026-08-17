import {
  alignPopoverCloseWithHeader,
  outlinePopoverArrow,
  TOUR_ARROW_OUTLINE_CLASS,
} from '../tour-popover-chrome';

function popoverParts() {
  const wrapper = document.createElement('div');
  const closeButton = document.createElement('button');
  const title = document.createElement('header');
  wrapper.append(closeButton, title);
  return { wrapper, closeButton, title };
}

describe('tour popover chrome', () => {
  it('marks the pointer triangle so its outline continues the card border', () => {
    const wrapper = document.createElement('div');

    outlinePopoverArrow({ wrapper });

    expect(wrapper).toHaveClass(TOUR_ARROW_OUTLINE_CLASS);
  });

  it.each([
    ['coachmark', 'dalgo-tour-heading-row--coachmark'],
    ['product-tour', 'dalgo-tour-heading-row--product-tour'],
  ] as const)('aligns the %s close button in the same row as its header', (kind, kindClass) => {
    const { wrapper, closeButton, title } = popoverParts();

    const row = alignPopoverCloseWithHeader({ closeButton, title }, kind);

    expect(wrapper.firstElementChild).toBe(row);
    expect(row).toHaveClass('dalgo-tour-heading-row', kindClass);
    expect(Array.from(row.children)).toEqual([title, closeButton]);
  });

  it('keeps an illustration above the complete heading row', () => {
    const { wrapper, closeButton, title } = popoverParts();
    const illustration = document.createElement('img');
    title.before(illustration);

    const row = alignPopoverCloseWithHeader({ closeButton, title }, 'coachmark');

    expect(Array.from(wrapper.children)).toEqual([illustration, row]);
  });
});
