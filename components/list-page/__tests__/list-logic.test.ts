import {
  countActiveFilters,
  createEmptyDateFilter,
  filterOptionsBySearch,
  formatDateInputValue,
  formatItemRange,
  matchesDateFilter,
  paginateRows,
  parseDateInputValue,
  sortRows,
  toggleValue,
  type DateFilter,
} from '@/components/list-page/list-logic';

describe('sortRows', () => {
  const rows = [
    { id: 1, v: 'b' },
    { id: 2, v: 'a' },
    { id: 3, v: 'b' },
    { id: 4, v: 'c' },
  ];

  it('sorts ascending', () => {
    expect(sortRows(rows, (r) => r.v, 'asc').map((r) => r.id)).toEqual([2, 1, 3, 4]);
  });

  it('sorts descending', () => {
    expect(sortRows(rows, (r) => r.v, 'desc').map((r) => r.id)).toEqual([4, 1, 3, 2]);
  });

  it('ties keep the server order in both directions (pinned: "Sort ties fall back to server order")', () => {
    expect(
      sortRows(rows, (r) => r.v, 'asc')
        .filter((r) => r.v === 'b')
        .map((r) => r.id)
    ).toEqual([1, 3]);
    expect(
      sortRows(rows, (r) => r.v, 'desc')
        .filter((r) => r.v === 'b')
        .map((r) => r.id)
    ).toEqual([1, 3]);
  });

  it('sorts numbers and leaves the input untouched', () => {
    const nums = [{ n: 3 }, { n: 1 }, { n: 2 }];
    expect(sortRows(nums, (r) => r.n, 'asc').map((r) => r.n)).toEqual([1, 2, 3]);
    expect(nums.map((r) => r.n)).toEqual([3, 1, 2]);
  });
});

describe('paginateRows', () => {
  const rows = Array.from({ length: 25 }, (_, i) => i + 1);
  it('slices one page', () => {
    expect(paginateRows(rows, 2, 10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(paginateRows(rows, 3, 10)).toEqual([21, 22, 23, 24, 25]);
  });
  it('a page past the end is empty', () => {
    expect(paginateRows(rows, 4, 10)).toEqual([]);
  });
});

describe('formatItemRange', () => {
  it('formats the visible range', () => {
    expect(formatItemRange(1, 10, 45)).toBe('1–10 of 45');
    expect(formatItemRange(5, 10, 45)).toBe('41–45 of 45');
  });
  it('shows 0–0 of 0 when empty', () => {
    expect(formatItemRange(1, 10, 0)).toBe('0–0 of 0');
  });
  it('a page past the end shows an inverted range (pinned R-L3 "11–10 of 10")', () => {
    expect(formatItemRange(2, 10, 10)).toBe('11–10 of 10');
  });
});

describe('countActiveFilters', () => {
  it('counts true flags', () => {
    expect(countActiveFilters([true, false, true, false])).toBe(2);
    expect(countActiveFilters([])).toBe(0);
  });
});

describe('toggleValue', () => {
  it('removes a present value and appends a missing one', () => {
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b']);
  });
});

describe('filterOptionsBySearch', () => {
  it('keeps case-insensitive substring matches in order', () => {
    expect(
      filterOptionsBySearch(['public.Sales', 'staging.orders', 'public.users'], 'PUBLIC')
    ).toEqual(['public.Sales', 'public.users']);
    expect(filterOptionsBySearch(['a', 'b'], '')).toEqual(['a', 'b']);
  });
});

describe('matchesDateFilter', () => {
  const now = new Date(2026, 9, 4, 12, 0, 0); // local 4 Oct 2026 12:00
  const DAY = 24 * 60 * 60 * 1000;
  const iso = (d: Date) => d.toISOString();
  const filter = (patch: Partial<DateFilter>): DateFilter => ({
    ...createEmptyDateFilter(),
    ...patch,
  });

  it('"all" and a missing timestamp always match', () => {
    expect(matchesDateFilter(iso(new Date(2000, 0, 1)), filter({}), now)).toBe(true);
    expect(matchesDateFilter(undefined, filter({ range: 'today' }), now)).toBe(true);
  });

  it('today starts at local midnight', () => {
    expect(
      matchesDateFilter(iso(new Date(2026, 9, 4, 0, 30)), filter({ range: 'today' }), now)
    ).toBe(true);
    expect(
      matchesDateFilter(iso(new Date(2026, 9, 3, 23, 59)), filter({ range: 'today' }), now)
    ).toBe(false);
  });

  it('week = last 7×24h, month = last 30×24h', () => {
    expect(
      matchesDateFilter(iso(new Date(now.getTime() - 6 * DAY)), filter({ range: 'week' }), now)
    ).toBe(true);
    expect(
      matchesDateFilter(iso(new Date(now.getTime() - 8 * DAY)), filter({ range: 'week' }), now)
    ).toBe(false);
    expect(
      matchesDateFilter(iso(new Date(now.getTime() - 29 * DAY)), filter({ range: 'month' }), now)
    ).toBe(true);
    expect(
      matchesDateFilter(iso(new Date(now.getTime() - 31 * DAY)), filter({ range: 'month' }), now)
    ).toBe(false);
  });

  it('custom checks each bound only when set', () => {
    const range = filter({
      range: 'custom',
      customStart: new Date(2026, 8, 1),
      customEnd: new Date(2026, 8, 30),
    });
    expect(matchesDateFilter(iso(new Date(2026, 8, 15)), range, now)).toBe(true);
    expect(matchesDateFilter(iso(new Date(2026, 9, 1)), range, now)).toBe(false);
    expect(matchesDateFilter(iso(new Date(2026, 7, 31)), range, now)).toBe(false);
    expect(
      matchesDateFilter(
        iso(new Date(2030, 0, 1)),
        filter({ range: 'custom', customStart: new Date(2026, 8, 1) }),
        now
      )
    ).toBe(true);
  });

  it('an unparseable timestamp matches (comparisons with NaN are false)', () => {
    expect(matchesDateFilter('not a date', filter({ range: 'today' }), now)).toBe(true);
  });
});

describe('date input helpers', () => {
  it('iso-date parses as UTC midnight and formats the UTC date (charts)', () => {
    expect(parseDateInputValue('2026-03-05', 'iso-date')?.toISOString()).toBe(
      '2026-03-05T00:00:00.000Z'
    );
    expect(formatDateInputValue(new Date('2026-03-05T00:00:00.000Z'), 'iso-date')).toBe(
      '2026-03-05'
    );
  });

  it('local-date parses as local midnight and formats the local date (dashboards)', () => {
    const parsed = parseDateInputValue('2026-03-05', 'local-date');
    expect([
      parsed?.getFullYear(),
      parsed?.getMonth(),
      parsed?.getDate(),
      parsed?.getHours(),
    ]).toEqual([2026, 2, 5, 0]);
    expect(formatDateInputValue(new Date(2026, 2, 5), 'local-date')).toBe('2026-03-05');
  });

  it('empty input means no bound', () => {
    expect(parseDateInputValue('', 'iso-date')).toBeNull();
    expect(parseDateInputValue('', 'local-date')).toBeNull();
    expect(formatDateInputValue(null, 'iso-date')).toBe('');
    expect(formatDateInputValue(null, 'local-date')).toBe('');
  });
});
