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
  localTimeToUTC,
  utcTimeToLocal,
  getFlowRunStartedBy,
  calculateDuration,
} from '../pipeline-utils';
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
