import { localScheduleToUtcCron, utcCronToLocalSchedule, type ScheduleSpec } from '@/types/alerts';

// These tests are timezone-sensitive. We assert by round-tripping the spec —
// (local → UTC cron → local) must reproduce the original — which holds in any
// fixed TZ environment, including CI's UTC.

function roundtrip(spec: ScheduleSpec) {
  const cron = localScheduleToUtcCron(spec);
  const back = utcCronToLocalSchedule(cron);
  return { cron, back };
}

describe('localScheduleToUtcCron / utcCronToLocalSchedule', () => {
  it('emits a 5-field cron expression for daily', () => {
    const cron = localScheduleToUtcCron({ frequency: 'daily', hour: 9, minute: 30 });
    expect(cron.split(/\s+/)).toHaveLength(5);
    expect(cron).toMatch(/^\d+ \d+ \* \* \*$/);
  });

  it('emits weekly cron with explicit dow', () => {
    const cron = localScheduleToUtcCron({
      frequency: 'weekly',
      hour: 14,
      minute: 15,
      dayOfWeek: 3,
    });
    expect(cron).toMatch(/^\d+ \d+ \* \* \d+$/);
  });

  it('emits monthly cron with explicit dom (clamped to [1,28])', () => {
    const cron = localScheduleToUtcCron({
      frequency: 'monthly',
      hour: 6,
      minute: 0,
      dayOfMonth: 31,
    });
    const parts = cron.split(/\s+/);
    expect(parts[3]).toBe('*');
    expect(parts[4]).toBe('*');
    const dom = parseInt(parts[2], 10);
    expect(dom).toBeGreaterThanOrEqual(1);
    expect(dom).toBeLessThanOrEqual(28);
  });

  it('round-trips a daily schedule preserving hour and minute', () => {
    const spec: ScheduleSpec = { frequency: 'daily', hour: 9, minute: 30 };
    const { back } = roundtrip(spec);
    expect(back).not.toBeNull();
    expect(back!.frequency).toBe('daily');
    expect(back!.hour).toBe(9);
    expect(back!.minute).toBe(30);
  });

  it('round-trips a weekly schedule preserving day-of-week + time', () => {
    const spec: ScheduleSpec = {
      frequency: 'weekly',
      hour: 16,
      minute: 45,
      dayOfWeek: 5,
    };
    const { back } = roundtrip(spec);
    expect(back).not.toBeNull();
    expect(back!.frequency).toBe('weekly');
    expect(back!.hour).toBe(16);
    expect(back!.minute).toBe(45);
    expect(back!.dayOfWeek).toBe(5);
  });

  it('round-trips a monthly schedule preserving day-of-month + time', () => {
    const spec: ScheduleSpec = {
      frequency: 'monthly',
      hour: 7,
      minute: 0,
      dayOfMonth: 15,
    };
    const { back } = roundtrip(spec);
    expect(back).not.toBeNull();
    expect(back!.frequency).toBe('monthly');
    expect(back!.hour).toBe(7);
    expect(back!.minute).toBe(0);
    expect(back!.dayOfMonth).toBe(15);
  });

  it('returns null for cron patterns we do not produce (5-field but mixed dow + dom)', () => {
    expect(utcCronToLocalSchedule('30 3 * * 1,2,3')).toBeNull();
    expect(utcCronToLocalSchedule('*/15 * * * *')).toBeNull();
  });

  it('returns null for malformed cron strings', () => {
    expect(utcCronToLocalSchedule('not a cron')).toBeNull();
    expect(utcCronToLocalSchedule('30 3 *')).toBeNull();
  });
});

/**
 * Month-boundary regression tests for the dayShift calculation.
 *
 * The dayShift logic compares local-vs-UTC calendar day for the current Date.
 * Using numeric `>` on day-of-month numbers (1..31) silently inverts the sign
 * when local day is 1 and UTC day is 31 (or vice versa). Tests below pin a
 * non-UTC timezone, mock `Date` so the wizard's `today` lands on a month
 * boundary, and assert the cron stays correct.
 *
 * Each test mocks both local Date fields and UTC Date fields so the same
 * instant has local day = 1 / UTC day = 31 (or the inverse). Helpers below.
 */
type DateMocks = {
  fullYear: number;
  month: number;
  date: number;
  hours: number;
  minutes: number;
  utcFullYear: number;
  utcMonth: number;
  utcDate: number;
  utcHours: number;
  utcMinutes: number;
};
function mockDate(m: DateMocks) {
  const spies = [
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(m.fullYear),
    jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(m.month),
    jest.spyOn(Date.prototype, 'getDate').mockReturnValue(m.date),
    jest.spyOn(Date.prototype, 'getHours').mockReturnValue(m.hours),
    jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(m.minutes),
    jest.spyOn(Date.prototype, 'getUTCFullYear').mockReturnValue(m.utcFullYear),
    jest.spyOn(Date.prototype, 'getUTCMonth').mockReturnValue(m.utcMonth),
    jest.spyOn(Date.prototype, 'getUTCDate').mockReturnValue(m.utcDate),
    jest.spyOn(Date.prototype, 'getUTCHours').mockReturnValue(m.utcHours),
    jest.spyOn(Date.prototype, 'getUTCMinutes').mockReturnValue(m.utcMinutes),
  ];
  return () => spies.forEach((s) => s.mockRestore());
}

describe('schedule dayShift at month boundaries', () => {
  it('localScheduleToUtcCron: IST user creating Tuesday 02:00 on April 1 stores Monday UTC', () => {
    // Local Apr 1 02:00 IST = Mar 31 20:30 UTC.
    // local day-of-month = 1, UTC day-of-month = 31. The buggy comparison
    // (31 > 1 → +1) would store DOW = Wednesday; the fix gives DOW = Monday.
    const restore = mockDate({
      fullYear: 2026,
      month: 3, // April
      date: 1,
      hours: 2,
      minutes: 0,
      utcFullYear: 2026,
      utcMonth: 2, // March
      utcDate: 31,
      utcHours: 20,
      utcMinutes: 30,
    });

    const cron = localScheduleToUtcCron({
      frequency: 'weekly',
      hour: 2,
      minute: 0,
      dayOfWeek: 2, // Tuesday
    });

    expect(cron).toBe('30 20 * * 1'); // Monday UTC

    restore();
  });

  it('localScheduleToUtcCron: PST user creating Tuesday 22:00 on March 31 stores Wednesday UTC', () => {
    // Local Mar 31 22:00 PDT = Apr 1 05:00 UTC.
    // local day = 31, UTC day = 1. Buggy (1 > 31 → false → -1) would store
    // DOW = Monday; the fix stores Wednesday (one ahead of local Tue).
    const restore = mockDate({
      fullYear: 2026,
      month: 2, // March
      date: 31,
      hours: 22,
      minutes: 0,
      utcFullYear: 2026,
      utcMonth: 3, // April
      utcDate: 1,
      utcHours: 5,
      utcMinutes: 0,
    });

    const cron = localScheduleToUtcCron({
      frequency: 'weekly',
      hour: 22,
      minute: 0,
      dayOfWeek: 2, // Tuesday local
    });

    expect(cron).toBe('0 5 * * 3'); // Wednesday UTC

    restore();
  });

  it('utcCronToLocalSchedule: IST reading Monday-20:30 UTC stored on March 31 returns Tuesday local', () => {
    // utc = Mar 31 20:30 UTC → local Apr 1 02:00 IST. UTC day 31 → local day 1.
    // Buggy (31 > 1 → -1) returns Sunday; fix returns Tuesday.
    const restore = mockDate({
      fullYear: 2026,
      month: 3, // April (local)
      date: 1,
      hours: 2,
      minutes: 0,
      utcFullYear: 2026,
      utcMonth: 2, // March (UTC)
      utcDate: 31,
      utcHours: 20,
      utcMinutes: 30,
    });

    const back = utcCronToLocalSchedule('30 20 * * 1');

    expect(back).not.toBeNull();
    expect(back!.frequency).toBe('weekly');
    expect(back!.hour).toBe(2);
    expect(back!.minute).toBe(0);
    expect(back!.dayOfWeek).toBe(2); // Tuesday local

    restore();
  });

  it('utcCronToLocalSchedule: PST reading Wednesday-05:00 UTC stored on April 1 returns Tuesday local', () => {
    // utc = Apr 1 05:00 UTC → local Mar 31 22:00 PDT. UTC day 1 → local day 31.
    // Buggy (1 > 31 → false → +1) returns Thursday; fix returns Tuesday.
    const restore = mockDate({
      fullYear: 2026,
      month: 2, // March (local)
      date: 31,
      hours: 22,
      minutes: 0,
      utcFullYear: 2026,
      utcMonth: 3, // April (UTC)
      utcDate: 1,
      utcHours: 5,
      utcMinutes: 0,
    });

    const back = utcCronToLocalSchedule('0 5 * * 3');

    expect(back).not.toBeNull();
    expect(back!.frequency).toBe('weekly');
    expect(back!.hour).toBe(22);
    expect(back!.minute).toBe(0);
    expect(back!.dayOfWeek).toBe(2); // Tuesday local

    restore();
  });
});
