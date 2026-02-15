/**
 * Pipeline Utilities - Comprehensive Tests
 */

import {
  lastRunTime,
  formatDuration,
  trimEmail,
  getTaskOrder,
  makeReadable,
  validateDefaultTasksToApplyInPipeline,
  convertToCronExpression,
  convertCronToSchedule,
  cronToString,
  cronToLocalTZ,
  localTimeToUTC,
  utcTimeToLocal,
  getFlowRunStartedBy,
  calculateDuration,
} from '../pipeline-utils';
import moment from 'moment';
import { TransformTask } from '@/types/pipeline';

describe('Pipeline Utilities', () => {
  describe('Time and Duration Formatting', () => {
    it('handles all time formatting scenarios', () => {
      // lastRunTime
      expect(lastRunTime(null)).toBe('-');
      expect(lastRunTime(undefined)).toBe('-');
      expect(lastRunTime('')).toBe('-');
      expect(lastRunTime('invalid-date')).toBe('-');
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(lastRunTime(fiveMinutesAgo)).toContain('ago');

      // formatDuration - various ranges
      expect(formatDuration(0)).toBe('0s');
      expect(formatDuration(45)).toBe('45s');
      expect(formatDuration(125)).toBe('2m 5s');
      expect(formatDuration(3725)).toBe('1h 2m');
      expect(formatDuration(90000)).toBe('1d 1h');
      // Limits to 2 metrics
      expect(formatDuration(1 * 86400 + 2 * 3600 + 3 * 60 + 4)).toBe('1d 2h');

      // calculateDuration
      expect(calculateDuration('2025-01-01T10:00:00.000Z', '2025-01-01T10:05:30.000Z')).toBe(330);
      expect(calculateDuration('2025-01-01T10:00:00.000Z', '2025-01-01T10:00:00.000Z')).toBe(0);
    });
  });

  describe('Cron Expression Handling', () => {
    it('converts schedule settings to cron and back', () => {
      // convertToCronExpression
      expect(convertToCronExpression('manual')).toBe('');
      expect(convertToCronExpression('daily')).toBe('0 1 * * *');
      expect(convertToCronExpression('daily', [], '9 30')).toBe('30 9 * * *');
      expect(convertToCronExpression('weekly', ['1'], '9 0')).toBe('0 9 * * 1');
      expect(convertToCronExpression('weekly', ['1', '3', '5'], '9 0')).toBe('0 9 * * 1,3,5');

      // convertCronToSchedule
      const manual = convertCronToSchedule(null);
      expect(manual.schedule).toBe('manual');
      expect(manual.daysOfWeek).toEqual([]);

      const daily = convertCronToSchedule('30 9 * * *');
      expect(daily.schedule).toBe('daily');
      expect(daily.timeOfDay).toBe('9 30');

      const weekly = convertCronToSchedule('0 10 * * 1,3,5');
      expect(weekly.schedule).toBe('weekly');
      expect(weekly.daysOfWeek).toEqual(['1', '3', '5']);

      // Handles 6-field cron (with seconds)
      const sixField = convertCronToSchedule('0 30 9 * * *');
      expect(sixField.schedule).toBe('daily');

      // Invalid cron returns manual
      expect(convertCronToSchedule('invalid').schedule).toBe('manual');

      // cronToString
      expect(cronToString(null)).toBe('Manual');
      expect(cronToString('')).toBe('Manual');
      expect(cronToString('0 9 * * *')).toMatch(/Daily at \d{1,2}:\d{2} (AM|PM)/);
    });

    it('full pipeline form flow: cron → display → edit → save preserves UTC time', () => {
      // Simulate: existing pipeline with cron "30 14 * * 1,3,5" (14:30 UTC on Mon/Wed/Fri)
      const existingCron = '30 14 * * 1,3,5';

      // Step 1: Parse cron for form display (what pipeline-form.tsx does on load)
      const cronObject = convertCronToSchedule(existingCron);
      expect(cronObject.schedule).toBe('weekly');
      expect(cronObject.timeOfDay).toBe('14 30'); // UTC time in "H M" format
      expect(cronObject.daysOfWeek).toEqual(['1', '3', '5']);

      // Step 2: Convert UTC time to local for display in time picker
      const localTimeForDisplay = utcTimeToLocal(cronObject.timeOfDay);
      expect(localTimeForDisplay).toMatch(/^\d{2}:\d{2}$/); // "HH:mm" format

      // Step 3: User doesn't change time, just saves - convert back to UTC
      const utcTimeForSave = localTimeToUTC(localTimeForDisplay);
      const [saveH, saveM] = utcTimeForSave.split(' ').map(Number);
      expect(saveH).toBe(14);
      expect(saveM).toBe(30);

      // Step 4: Generate cron expression for save
      const savedCron = convertToCronExpression('weekly', ['1', '3', '5'], utcTimeForSave);
      expect(savedCron).toBe(existingCron); // Should match original!
    });

    it('full pipeline form flow: new daily schedule creation', () => {
      // User selects daily at 9:00 AM local time
      const localTime = '09:00';

      // Convert to UTC for storage
      const utcTime = localTimeToUTC(localTime);

      // Generate cron
      const cron = convertToCronExpression('daily', [], utcTime);

      // Parse it back
      const parsed = convertCronToSchedule(cron);
      expect(parsed.schedule).toBe('daily');

      // Convert back to local for verification
      const displayTime = utcTimeToLocal(parsed.timeOfDay);
      expect(displayTime).toBe(localTime); // Should match what user entered!
    });
  });

  describe('cronToLocalTZ Day-of-Week Adjustment', () => {
    // These tests verify that when UTC→local conversion crosses a day boundary,
    // the day-of-week field is correctly adjusted

    it('returns empty string for empty input', () => {
      expect(cronToLocalTZ('')).toBe('');
    });

    it('returns empty string for invalid cron (wrong field count)', () => {
      expect(cronToLocalTZ('0 1 *')).toBe('');
      expect(cronToLocalTZ('0 1 * * * * *')).toBe('');
    });

    it('handles 6-field cron (with seconds) by stripping seconds', () => {
      // 6-field cron: seconds minutes hours dom month dow
      const result = cronToLocalTZ('0 0 10 * * 3');
      // Should process as "0 10 * * 3" after stripping seconds
      expect(result).toMatch(/^\d+ \d+ \* \* \d+$/);
    });

    it('returns original expression if day-of-month or month is not *', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      expect(cronToLocalTZ('0 10 15 * 3')).toBe('0 10 15 * 3'); // day-of-month = 15
      expect(cronToLocalTZ('0 10 * 6 3')).toBe('0 10 * 6 3'); // month = 6
      consoleSpy.mockRestore();
    });

    it('preserves wildcard day-of-week (*) regardless of day shift', () => {
      // Daily schedule - should never change the *
      const result = cronToLocalTZ('0 22 * * *');
      expect(result).toMatch(/\* \* \*$/); // ends with "* * *"
    });

    it('adjusts single day-of-week when crossing day boundary forward', () => {
      // Mock moment to simulate a timezone with +5:30 offset (like IST)
      // When UTC time is 22:00, local time would be 03:30 next day
      const mockLocalTime = {
        minutes: jest.fn().mockReturnValue(30),
        hours: jest.fn().mockReturnValue(3),
        date: jest.fn().mockReturnValue(16), // next day
      };
      const mockUtcTime = {
        hours: jest.fn().mockReturnThis(),
        minutes: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue({
          local: jest.fn().mockReturnValue(mockLocalTime),
        }),
        date: jest.fn().mockReturnValue(15), // current day
      };

      const originalUtc = moment.utc;
      moment.utc = jest.fn().mockReturnValue(mockUtcTime) as typeof moment.utc;

      // Wed (3) at 22:00 UTC should become Thu (4) at 03:30 local
      const result = cronToLocalTZ('0 22 * * 3');
      expect(result).toBe('30 3 * * 4');

      moment.utc = originalUtc;
    });

    it('adjusts single day-of-week when crossing day boundary backward', () => {
      // Mock moment to simulate a timezone with -5:00 offset (like EST)
      // When UTC time is 02:00, local time would be 21:00 previous day
      const mockLocalTime = {
        minutes: jest.fn().mockReturnValue(0),
        hours: jest.fn().mockReturnValue(21),
        date: jest.fn().mockReturnValue(14), // previous day
      };
      const mockUtcTime = {
        hours: jest.fn().mockReturnThis(),
        minutes: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue({
          local: jest.fn().mockReturnValue(mockLocalTime),
        }),
        date: jest.fn().mockReturnValue(15), // current day
      };

      const originalUtc = moment.utc;
      moment.utc = jest.fn().mockReturnValue(mockUtcTime) as typeof moment.utc;

      // Wed (3) at 02:00 UTC should become Tue (2) at 21:00 local
      const result = cronToLocalTZ('0 2 * * 3');
      expect(result).toBe('0 21 * * 2');

      moment.utc = originalUtc;
    });

    it('handles week wrap-around: Saturday (6) + 1 = Sunday (0)', () => {
      const mockLocalTime = {
        minutes: jest.fn().mockReturnValue(30),
        hours: jest.fn().mockReturnValue(3),
        date: jest.fn().mockReturnValue(16), // next day
      };
      const mockUtcTime = {
        hours: jest.fn().mockReturnThis(),
        minutes: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue({
          local: jest.fn().mockReturnValue(mockLocalTime),
        }),
        date: jest.fn().mockReturnValue(15),
      };

      const originalUtc = moment.utc;
      moment.utc = jest.fn().mockReturnValue(mockUtcTime) as typeof moment.utc;

      // Sat (6) should wrap to Sun (0)
      const result = cronToLocalTZ('0 22 * * 6');
      expect(result).toBe('30 3 * * 0');

      moment.utc = originalUtc;
    });

    it('handles week wrap-around: Sunday (0) - 1 = Saturday (6)', () => {
      const mockLocalTime = {
        minutes: jest.fn().mockReturnValue(0),
        hours: jest.fn().mockReturnValue(21),
        date: jest.fn().mockReturnValue(14), // previous day
      };
      const mockUtcTime = {
        hours: jest.fn().mockReturnThis(),
        minutes: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue({
          local: jest.fn().mockReturnValue(mockLocalTime),
        }),
        date: jest.fn().mockReturnValue(15),
      };

      const originalUtc = moment.utc;
      moment.utc = jest.fn().mockReturnValue(mockUtcTime) as typeof moment.utc;

      // Sun (0) should wrap to Sat (6)
      const result = cronToLocalTZ('0 2 * * 0');
      expect(result).toBe('0 21 * * 6');

      moment.utc = originalUtc;
    });

    it('adjusts multiple comma-separated days', () => {
      const mockLocalTime = {
        minutes: jest.fn().mockReturnValue(30),
        hours: jest.fn().mockReturnValue(3),
        date: jest.fn().mockReturnValue(16), // +1 day shift
      };
      const mockUtcTime = {
        hours: jest.fn().mockReturnThis(),
        minutes: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue({
          local: jest.fn().mockReturnValue(mockLocalTime),
        }),
        date: jest.fn().mockReturnValue(15),
      };

      const originalUtc = moment.utc;
      moment.utc = jest.fn().mockReturnValue(mockUtcTime) as typeof moment.utc;

      // Mon,Wed,Fri (1,3,5) should become Tue,Thu,Sat (2,4,6)
      const result = cronToLocalTZ('0 22 * * 1,3,5');
      expect(result).toBe('30 3 * * 2,4,6');

      moment.utc = originalUtc;
    });

    it('adjusts day ranges', () => {
      const mockLocalTime = {
        minutes: jest.fn().mockReturnValue(30),
        hours: jest.fn().mockReturnValue(3),
        date: jest.fn().mockReturnValue(16), // +1 day shift
      };
      const mockUtcTime = {
        hours: jest.fn().mockReturnThis(),
        minutes: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue({
          local: jest.fn().mockReturnValue(mockLocalTime),
        }),
        date: jest.fn().mockReturnValue(15),
      };

      const originalUtc = moment.utc;
      moment.utc = jest.fn().mockReturnValue(mockUtcTime) as typeof moment.utc;

      // Mon-Fri (1-5) should become Tue-Sat (2-6)
      const result = cronToLocalTZ('0 22 * * 1-5');
      expect(result).toBe('30 3 * * 2-6');

      moment.utc = originalUtc;
    });

    it('handles month boundary: day 31 to day 1 is +1 shift', () => {
      const mockLocalTime = {
        minutes: jest.fn().mockReturnValue(30),
        hours: jest.fn().mockReturnValue(3),
        date: jest.fn().mockReturnValue(1), // next month, day 1
      };
      const mockUtcTime = {
        hours: jest.fn().mockReturnThis(),
        minutes: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue({
          local: jest.fn().mockReturnValue(mockLocalTime),
        }),
        date: jest.fn().mockReturnValue(31), // last day of month
      };

      const originalUtc = moment.utc;
      moment.utc = jest.fn().mockReturnValue(mockUtcTime) as typeof moment.utc;

      // 31 - 1 = -30, but should normalize to +1
      const result = cronToLocalTZ('0 22 * * 3');
      expect(result).toBe('30 3 * * 4'); // Wed → Thu

      moment.utc = originalUtc;
    });

    it('handles month boundary: day 1 to day 31 is -1 shift', () => {
      const mockLocalTime = {
        minutes: jest.fn().mockReturnValue(0),
        hours: jest.fn().mockReturnValue(21),
        date: jest.fn().mockReturnValue(31), // previous month, day 31
      };
      const mockUtcTime = {
        hours: jest.fn().mockReturnThis(),
        minutes: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue({
          local: jest.fn().mockReturnValue(mockLocalTime),
        }),
        date: jest.fn().mockReturnValue(1), // first day of month
      };

      const originalUtc = moment.utc;
      moment.utc = jest.fn().mockReturnValue(mockUtcTime) as typeof moment.utc;

      // 1 - 31 = +30, but should normalize to -1
      const result = cronToLocalTZ('0 2 * * 3');
      expect(result).toBe('0 21 * * 2'); // Wed → Tue

      moment.utc = originalUtc;
    });

    it('no shift when UTC and local are same day', () => {
      const mockLocalTime = {
        minutes: jest.fn().mockReturnValue(30),
        hours: jest.fn().mockReturnValue(15),
        date: jest.fn().mockReturnValue(15), // same day
      };
      const mockUtcTime = {
        hours: jest.fn().mockReturnThis(),
        minutes: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue({
          local: jest.fn().mockReturnValue(mockLocalTime),
        }),
        date: jest.fn().mockReturnValue(15),
      };

      const originalUtc = moment.utc;
      moment.utc = jest.fn().mockReturnValue(mockUtcTime) as typeof moment.utc;

      // No shift, day stays the same
      const result = cronToLocalTZ('0 10 * * 3');
      expect(result).toBe('30 15 * * 3');

      moment.utc = originalUtc;
    });

    it('integration test with real moment.js (no mocking)', () => {
      // This test verifies the function works with real moment.js
      // The exact output depends on the test runner's timezone
      const result = cronToLocalTZ('0 10 * * 3');

      // Should return valid 5-field cron
      expect(result).toMatch(/^\d+ \d+ \* \* \d+$/);

      const parts = result.split(' ');
      expect(parts).toHaveLength(5);

      // Day-of-week should be valid (0-6)
      const dow = parseInt(parts[4], 10);
      expect(dow).toBeGreaterThanOrEqual(0);
      expect(dow).toBeLessThanOrEqual(6);
    });
  });

  describe('UTC/Local Time Conversion', () => {
    it('handles empty and edge cases', () => {
      expect(utcTimeToLocal('')).toBe('');
    });

    it('converts local time to UTC format correctly', () => {
      const utcResult = localTimeToUTC('09:30');
      // Should return "H M" format (space-separated hours and minutes)
      expect(utcResult).toMatch(/^\d{1,2} \d{1,2}$/);

      // Verify the parts are valid hour/minute values
      const [hours, minutes] = utcResult.split(' ').map(Number);
      expect(hours).toBeGreaterThanOrEqual(0);
      expect(hours).toBeLessThan(24);
      expect(minutes).toBeGreaterThanOrEqual(0);
      expect(minutes).toBeLessThan(60);
    });

    it('converts UTC time to local format correctly', () => {
      const localResult = utcTimeToLocal('9 30');
      // Should return "HH:mm" format (colon-separated, zero-padded)
      expect(localResult).toMatch(/^\d{2}:\d{2}$/);

      // Verify the parts are valid hour/minute values
      const [hours, minutes] = localResult.split(':').map(Number);
      expect(hours).toBeGreaterThanOrEqual(0);
      expect(hours).toBeLessThan(24);
      expect(minutes).toBeGreaterThanOrEqual(0);
      expect(minutes).toBeLessThan(60);
    });

    it('roundtrip: local → UTC → local preserves time', () => {
      // Test various times including edge cases
      const testTimes = ['00:00', '06:30', '12:00', '18:45', '23:59'];

      testTimes.forEach((originalLocal) => {
        const utc = localTimeToUTC(originalLocal);
        const backToLocal = utcTimeToLocal(utc);
        expect(backToLocal).toBe(originalLocal);
      });
    });

    it('roundtrip: UTC → local → UTC preserves time', () => {
      // Test various UTC times
      const testTimes = ['0 0', '6 30', '12 0', '18 45', '23 59'];

      testTimes.forEach((originalUtc) => {
        const local = utcTimeToLocal(originalUtc);
        const backToUtc = localTimeToUTC(local);

        // Parse both for comparison (handles single vs double digit formatting)
        const [origH, origM] = originalUtc.split(' ').map(Number);
        const [backH, backM] = backToUtc.split(' ').map(Number);
        expect(backH).toBe(origH);
        expect(backM).toBe(origM);
      });
    });

    it('timezone offset is applied correctly', () => {
      // Get current timezone offset in hours
      const offsetMinutes = new Date().getTimezoneOffset();

      // If offset is 0 (UTC timezone), these would be equal
      // Otherwise, they should differ by the offset amount
      const localTime = '12:00';
      const utcResult = localTimeToUTC(localTime);
      const [utcH, utcM] = utcResult.split(' ').map(Number);
      const [localH, localM] = localTime.split(':').map(Number);

      // Calculate expected UTC time based on offset
      // getTimezoneOffset returns minutes WEST of UTC (negative for east)
      const expectedUtcMinutes = (localH * 60 + localM + offsetMinutes + 1440) % 1440;
      const expectedUtcH = Math.floor(expectedUtcMinutes / 60);
      const expectedUtcM = expectedUtcMinutes % 60;

      expect(utcH).toBe(expectedUtcH);
      expect(utcM).toBe(expectedUtcM);
    });
  });

  describe('Task Utilities', () => {
    it('handles task ordering and validation', () => {
      // getTaskOrder - system commands
      expect(getTaskOrder('git-pull')).toBe(1);
      expect(getTaskOrder('dbt-clean')).toBe(2);
      expect(getTaskOrder('dbt-deps')).toBe(3);
      expect(getTaskOrder('dbt-run')).toBe(5);
      expect(getTaskOrder('dbt-test')).toBe(6);
      expect(getTaskOrder('custom-task')).toBe(5); // default

      // makeReadable
      expect(makeReadable('run-airbyte-connection-flow-v1')).toBe('sync');
      expect(makeReadable('shellop-git-pull')).toBe('Git pull');
      expect(makeReadable('dbtjob-dbt-run')).toBe('DBT run');
      expect(makeReadable('unknown-task')).toBe('unknown-task');

      // validateDefaultTasksToApplyInPipeline
      const systemTask: TransformTask = {
        label: 'Test',
        slug: 'test',
        deploymentId: null,
        lock: null,
        command: null,
        generated_by: 'system',
        uuid: '123',
        seq: 1,
        pipeline_default: true,
      };
      const clientTask: TransformTask = { ...systemTask, generated_by: 'client' };
      const nonDefaultTask: TransformTask = { ...systemTask, pipeline_default: false };

      expect(validateDefaultTasksToApplyInPipeline(systemTask)).toBe(true);
      expect(validateDefaultTasksToApplyInPipeline(clientTask)).toBe(false);
      expect(validateDefaultTasksToApplyInPipeline(nonDefaultTask)).toBe(false);
    });
  });

  describe('User Attribution', () => {
    it('handles flow run started by logic', () => {
      // Before cutoff date returns null
      expect(getFlowRunStartedBy(null, 'user@example.com')).toBeNull();
      expect(getFlowRunStartedBy('2025-05-19T00:00:00.0+00:00', 'user@example.com')).toBeNull();

      // After cutoff date
      expect(getFlowRunStartedBy('2025-05-21T00:00:00.0+00:00', 'System')).toBe('System');
      expect(getFlowRunStartedBy('2025-05-21T00:00:00.0+00:00', 'user@example.com')).toBe('user');

      // trimEmail
      expect(trimEmail('user@example.com')).toBe('user');
      expect(trimEmail('first.last@example.com')).toBe('first.last');
      expect(trimEmail('noatsymbol')).toBe('noatsymbol');
    });
  });
});
