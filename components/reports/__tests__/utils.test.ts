/**
 * Report Utilities Tests
 */

import { formatDateShort, formatCreatedOn } from '../utils';

describe('Report Utilities', () => {
  describe('formatDateShort', () => {
    it('formats date as "MMM do, yyyy"', () => {
      const result = formatDateShort('2025-01-15T10:30:00Z');
      expect(result).toBe('Jan 15th, 2025');
    });

    it('handles different months correctly', () => {
      expect(formatDateShort('2025-03-05T00:00:00Z')).toBe('Mar 5th, 2025');
      expect(formatDateShort('2025-12-25T00:00:00Z')).toBe('Dec 25th, 2025');
    });

    it('uses correct ordinal suffixes', () => {
      expect(formatDateShort('2025-01-01T00:00:00Z')).toBe('Jan 1st, 2025');
      expect(formatDateShort('2025-01-02T00:00:00Z')).toBe('Jan 2nd, 2025');
      expect(formatDateShort('2025-01-03T00:00:00Z')).toBe('Jan 3rd, 2025');
      expect(formatDateShort('2025-01-04T00:00:00Z')).toBe('Jan 4th, 2025');
      expect(formatDateShort('2025-01-21T00:00:00Z')).toBe('Jan 21st, 2025');
      expect(formatDateShort('2025-01-22T00:00:00Z')).toBe('Jan 22nd, 2025');
      expect(formatDateShort('2025-01-31T00:00:00Z')).toBe('Jan 31st, 2025');
    });

    it('handles different years correctly', () => {
      expect(formatDateShort('2024-06-15T00:00:00Z')).toBe('Jun 15th, 2024');
      expect(formatDateShort('2026-08-20T00:00:00Z')).toBe('Aug 20th, 2026');
    });
  });

  describe('formatCreatedOn', () => {
    // Mock current date for consistent testing
    const MOCK_NOW = new Date('2025-02-15T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(MOCK_NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    describe('Recent dates (within 7 days)', () => {
      it('formats date from a few hours ago as relative time', () => {
        const threeHoursAgo = new Date('2025-02-15T09:00:00Z').toISOString();
        const result = formatCreatedOn(threeHoursAgo);
        expect(result).toContain('hours ago');
      });

      it('formats date from yesterday as relative time', () => {
        const yesterday = new Date('2025-02-14T12:00:00Z').toISOString();
        const result = formatCreatedOn(yesterday);
        expect(result).toContain('day ago');
      });

      it('formats date from 3 days ago as relative time', () => {
        const threeDaysAgo = new Date('2025-02-12T12:00:00Z').toISOString();
        const result = formatCreatedOn(threeDaysAgo);
        expect(result).toContain('days ago');
      });

      it('formats date from 6 days ago as relative time', () => {
        const sixDaysAgo = new Date('2025-02-09T12:00:00Z').toISOString();
        const result = formatCreatedOn(sixDaysAgo);
        expect(result).toContain('days ago');
      });
    });

    describe('This year (but older than 7 days)', () => {
      it('formats date from 10 days ago as "d MMM"', () => {
        const tenDaysAgo = new Date('2025-02-05T12:00:00Z').toISOString();
        const result = formatCreatedOn(tenDaysAgo);
        expect(result).toBe('5 Feb');
      });

      it('formats date from January this year as "d MMM"', () => {
        const january = new Date('2025-01-20T12:00:00Z').toISOString();
        const result = formatCreatedOn(january);
        expect(result).toBe('20 Jan');
      });

      it('formats date from 30 days ago as "d MMM"', () => {
        const monthAgo = new Date('2025-01-15T12:00:00Z').toISOString();
        const result = formatCreatedOn(monthAgo);
        expect(result).toBe('15 Jan');
      });
    });

    describe('Previous years', () => {
      it('formats date from last year as "d MMM yyyy"', () => {
        const lastYear = new Date('2024-12-20T12:00:00Z').toISOString();
        const result = formatCreatedOn(lastYear);
        expect(result).toBe('20 Dec 2024');
      });

      it('formats date from 2023 as "d MMM yyyy"', () => {
        const twoYearsAgo = new Date('2023-06-15T12:00:00Z').toISOString();
        const result = formatCreatedOn(twoYearsAgo);
        expect(result).toBe('15 Jun 2023');
      });
    });

    describe('Edge cases', () => {
      it('handles exactly 7 days ago (boundary)', () => {
        const sevenDaysAgo = new Date('2025-02-08T12:00:00Z').toISOString();
        const result = formatCreatedOn(sevenDaysAgo);
        // Should use "d MMM" format (not relative)
        expect(result).toBe('8 Feb');
      });

      it('handles date from exactly 1 hour ago', () => {
        const oneHourAgo = new Date('2025-02-15T11:00:00Z').toISOString();
        const result = formatCreatedOn(oneHourAgo);
        expect(result).toContain('hour ago');
      });

      it('handles date from just now', () => {
        const justNow = new Date('2025-02-15T11:59:00Z').toISOString();
        const result = formatCreatedOn(justNow);
        expect(result).toContain('minute ago');
      });
    });
  });
});
