import { compactVertical, bottomY } from '../dashboard-animation-utils';

type Item = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

// Dashboard always renders on a 12-column grid (Superset-style); kept fixed across viewport sizes.
const GRID_COLS = 12;

describe('compactVertical', () => {
  const at = (i: string, x: number, y: number, w: number, h: number): Item => ({
    i,
    x,
    y,
    w,
    h,
  });

  it('slides a widget up to close empty space directly above it', () => {
    const result = compactVertical([at('a', 0, 5, 4, 2)], GRID_COLS);
    expect(result.find((r) => r.i === 'a')!.y).toBe(0);
  });

  it('keeps each widget in its own column (no horizontal move)', () => {
    const result = compactVertical([at('a', 0, 3, 4, 2), at('b', 6, 7, 4, 2)], GRID_COLS);
    const a = result.find((r) => r.i === 'a')!;
    const b = result.find((r) => r.i === 'b')!;
    expect([a.x, a.y]).toEqual([0, 0]);
    expect([b.x, b.y]).toEqual([6, 0]); // x unchanged, slid up independently
  });

  it('stacks two widgets that share columns without overlapping', () => {
    // both span cols 0-3; the lower one stacks directly beneath the upper one
    const result = compactVertical([at('a', 0, 10, 4, 3), at('b', 0, 20, 4, 2)], GRID_COLS);
    const a = result.find((r) => r.i === 'a')!;
    const b = result.find((r) => r.i === 'b')!;
    expect(a.y).toBe(0);
    expect(b.y).toBe(3); // directly below a (a.y 0 + a.h 3)
  });

  it('lets a short widget sit beside a tall one and a second short widget stack below it', () => {
    // tall 'a' cols 0-5 h=10; short 'b' cols 6-11 at top; short 'c' cols 6-11 lower
    // This is the DALGO-1219 "short below short beside tall" case.
    const result = compactVertical(
      [at('a', 0, 0, 6, 10), at('b', 6, 0, 6, 4), at('c', 6, 30, 6, 4)],
      GRID_COLS
    );
    const c = result.find((r) => r.i === 'c')!;
    expect([c.x, c.y]).toEqual([6, 4]); // c slides up to sit right under b, beside the tall a
  });

  it('preserves input array order (only y changes)', () => {
    const input = [at('a', 0, 9, 4, 2), at('b', 0, 0, 4, 2)];
    const result = compactVertical(input, GRID_COLS);
    expect(result.map((r) => r.i)).toEqual(['a', 'b']);
  });

  it('does not mutate the input', () => {
    const input = [at('a', 0, 5, 4, 2)];
    compactVertical(input, GRID_COLS);
    expect(input[0].y).toBe(5);
  });

  it('returns empty for empty input', () => {
    expect(compactVertical([], GRID_COLS)).toEqual([]);
  });
});

describe('bottomY', () => {
  it('returns 0 for an empty layout', () => {
    expect(bottomY([])).toBe(0);
  });

  it('returns the lowest y+h across all items', () => {
    expect(
      bottomY([
        { i: 'a', x: 0, y: 0, w: 4, h: 3 },
        { i: 'b', x: 6, y: 2, w: 4, h: 6 }, // bottom edge = 8
        { i: 'c', x: 0, y: 5, w: 4, h: 2 }, // bottom edge = 7
      ])
    ).toBe(8);
  });
});
