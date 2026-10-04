import type { KeyboardEvent, SetStateAction } from 'react';
import {
  handleMentionListKey,
  type MentionListKeyOptions,
} from '@/components/reports/comments/mention-keyboard';

const users = [{ email: 'a@x.org' }, { email: 'b@x.org' }, { email: 'c@x.org' }];

function pressKey(key: string, overrides: Partial<MentionListKeyOptions> = {}) {
  let nextIndex: number | undefined;
  const preventDefault = jest.fn();
  const event = { key, preventDefault } as unknown as KeyboardEvent<HTMLElement>;
  const options: MentionListKeyOptions = {
    isListOpen: true,
    users,
    highlightedIndex: 0,
    setHighlightedIndex: jest.fn(),
    onSelect: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  options.setHighlightedIndex = jest.fn((update: SetStateAction<number>) => {
    nextIndex = typeof update === 'function' ? update(options.highlightedIndex) : update;
  });
  const handled = handleMentionListKey(event, options);
  return { handled, nextIndex, preventDefault, options };
}

describe('handleMentionListKey', () => {
  it('ArrowDown moves down and wraps to the top', () => {
    expect(pressKey('ArrowDown', { highlightedIndex: 0 }).nextIndex).toBe(1);
    const wrapped = pressKey('ArrowDown', { highlightedIndex: 2 });
    expect(wrapped.nextIndex).toBe(0);
    expect(wrapped.handled).toBe(true);
    expect(wrapped.preventDefault).toHaveBeenCalled();
  });

  it('ArrowUp moves up and wraps to the bottom (also from "nothing highlighted")', () => {
    expect(pressKey('ArrowUp', { highlightedIndex: 2 }).nextIndex).toBe(1);
    expect(pressKey('ArrowUp', { highlightedIndex: 0 }).nextIndex).toBe(2);
    expect(pressKey('ArrowUp', { highlightedIndex: -1 }).nextIndex).toBe(2);
  });

  it('Enter selects the highlighted user', () => {
    const { handled, options, preventDefault } = pressKey('Enter', { highlightedIndex: 1 });
    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(options.onSelect).toHaveBeenCalledWith({ email: 'b@x.org' });
  });

  it('Enter with nothing highlighted is not handled (the caller may submit)', () => {
    const { handled, options, preventDefault } = pressKey('Enter', { highlightedIndex: -1 });
    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(options.onSelect).not.toHaveBeenCalled();
  });

  it('Escape closes the list and is handled (pinned: the popover still closes — Radix)', () => {
    const { handled, options, preventDefault } = pressKey('Escape');
    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(options.onClose).toHaveBeenCalled();
  });

  it('does nothing when the list is closed or empty, or for other keys', () => {
    const closedOrEmpty: Partial<MentionListKeyOptions>[] = [{ isListOpen: false }, { users: [] }];
    for (const overrides of closedOrEmpty) {
      const { handled, options, preventDefault } = pressKey('Escape', overrides);
      expect(handled).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
      expect(options.onClose).not.toHaveBeenCalled();
    }
    expect(pressKey('a').handled).toBe(false);
  });
});
