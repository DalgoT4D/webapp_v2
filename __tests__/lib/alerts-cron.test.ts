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
