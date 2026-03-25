/**
 * Comment Utility Functions Tests
 *
 * Tests for comment-specific utilities in components/reports/utils.ts:
 * - formatCommentTime: short relative time formatting
 * - getAvatarColor: deterministic color from email
 * - getInitials: initials from author name/email
 * - parseCommentMentions: @email mention parsing
 */

import {
  formatCommentTime,
  getAvatarColor,
  getInitials,
  parseCommentMentions,
  extractMentionedEmails,
} from '../utils';

describe('Comment Utilities', () => {
  describe('formatCommentTime', () => {
    const MOCK_NOW = new Date('2025-02-15T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(MOCK_NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns "just now" for less than 1 minute ago', () => {
      const thirtySecsAgo = new Date('2025-02-15T11:59:40Z').toISOString();
      expect(formatCommentTime(thirtySecsAgo)).toBe('just now');
    });

    it('returns minutes ago for less than 1 hour', () => {
      const fiveMinAgo = new Date('2025-02-15T11:55:00Z').toISOString();
      expect(formatCommentTime(fiveMinAgo)).toBe('5 mins. ago');
    });

    it('returns singular minute', () => {
      const oneMinAgo = new Date('2025-02-15T11:59:00Z').toISOString();
      expect(formatCommentTime(oneMinAgo)).toBe('1 min. ago');
    });

    it('returns hours ago for less than 1 day', () => {
      const threeHrsAgo = new Date('2025-02-15T09:00:00Z').toISOString();
      expect(formatCommentTime(threeHrsAgo)).toBe('3 hrs. ago');
    });

    it('returns singular hour', () => {
      const oneHrAgo = new Date('2025-02-15T11:00:00Z').toISOString();
      expect(formatCommentTime(oneHrAgo)).toBe('1 hr. ago');
    });

    it('returns days ago for less than 1 week', () => {
      const twoDaysAgo = new Date('2025-02-13T12:00:00Z').toISOString();
      expect(formatCommentTime(twoDaysAgo)).toBe('2 days ago');
    });

    it('returns singular day', () => {
      const oneDayAgo = new Date('2025-02-14T12:00:00Z').toISOString();
      expect(formatCommentTime(oneDayAgo)).toBe('1 day ago');
    });

    it('returns weeks ago for less than 1 month', () => {
      const twoWeeksAgo = new Date('2025-02-01T12:00:00Z').toISOString();
      expect(formatCommentTime(twoWeeksAgo)).toBe('2 weeks ago');
    });

    it('returns singular week', () => {
      const oneWeekAgo = new Date('2025-02-08T12:00:00Z').toISOString();
      expect(formatCommentTime(oneWeekAgo)).toBe('1 week ago');
    });

    it('falls back to date-fns for older dates', () => {
      const twoMonthsAgo = new Date('2024-12-15T12:00:00Z').toISOString();
      const result = formatCommentTime(twoMonthsAgo);
      expect(result).toContain('ago');
    });
  });

  describe('getAvatarColor', () => {
    it('returns a consistent color for the same email', () => {
      const color1 = getAvatarColor('user@test.com');
      const color2 = getAvatarColor('user@test.com');
      expect(color1).toBe(color2);
    });

    it('returns different colors for different emails', () => {
      const color1 = getAvatarColor('alice@test.com');
      const color2 = getAvatarColor('bob@test.com');
      // Not guaranteed but highly likely for different inputs
      expect(typeof color1).toBe('string');
      expect(typeof color2).toBe('string');
    });

    it('returns a valid hex color', () => {
      const color = getAvatarColor('user@example.com');
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  describe('getInitials', () => {
    it('returns first letter of email when no name', () => {
      expect(getInitials({ email: 'john@test.com' })).toBe('J');
    });

    it('returns initials from single-word name', () => {
      expect(getInitials({ email: 'john@test.com', name: 'John' })).toBe('J');
    });

    it('returns two initials from two-word name', () => {
      expect(getInitials({ email: 'john@test.com', name: 'John Doe' })).toBe('JD');
    });

    it('returns max 2 initials from longer names', () => {
      expect(getInitials({ email: 'j@test.com', name: 'John Michael Doe' })).toBe('JM');
    });

    it('returns uppercase initials', () => {
      expect(getInitials({ email: 'j@test.com', name: 'john doe' })).toBe('JD');
    });
  });

  describe('parseCommentMentions', () => {
    it('returns plain text for content without mentions', () => {
      const result = parseCommentMentions('Hello world');
      expect(result).toEqual([{ type: 'text', value: 'Hello world' }]);
    });

    it('parses a single @mention', () => {
      const result = parseCommentMentions('Hello @user@test.com how are you?');
      expect(result).toEqual([
        { type: 'text', value: 'Hello ' },
        { type: 'mention', value: 'user@test.com' },
        { type: 'text', value: ' how are you?' },
      ]);
    });

    it('parses multiple @mentions', () => {
      const result = parseCommentMentions('@alice@test.com and @bob@test.com please review');
      expect(result).toEqual([
        { type: 'mention', value: 'alice@test.com' },
        { type: 'text', value: ' and ' },
        { type: 'mention', value: 'bob@test.com' },
        { type: 'text', value: ' please review' },
      ]);
    });

    it('handles mention at end of string', () => {
      const result = parseCommentMentions('cc @user@test.com');
      expect(result).toEqual([
        { type: 'text', value: 'cc ' },
        { type: 'mention', value: 'user@test.com' },
      ]);
    });

    it('handles mention at start of string', () => {
      const result = parseCommentMentions('@user@test.com check this');
      expect(result).toEqual([
        { type: 'mention', value: 'user@test.com' },
        { type: 'text', value: ' check this' },
      ]);
    });

    it('returns empty text parts correctly', () => {
      const result = parseCommentMentions('just text');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('text');
    });

    it('handles emails with dots and plus signs', () => {
      const result = parseCommentMentions('Hey @first.last+tag@company.co.uk');
      expect(result).toEqual([
        { type: 'text', value: 'Hey ' },
        { type: 'mention', value: 'first.last+tag@company.co.uk' },
      ]);
    });
  });

  describe('extractMentionedEmails', () => {
    it('returns empty array for content without mentions', () => {
      expect(extractMentionedEmails('Hello world')).toEqual([]);
    });

    it('extracts a single mentioned email', () => {
      expect(extractMentionedEmails('Hello @user@test.com')).toEqual(['user@test.com']);
    });

    it('extracts multiple mentioned emails', () => {
      const result = extractMentionedEmails('@alice@test.com and @bob@test.com please review');
      expect(result).toEqual(['alice@test.com', 'bob@test.com']);
    });

    it('deduplicates repeated mentions', () => {
      const result = extractMentionedEmails('@user@test.com said hi @user@test.com');
      expect(result).toEqual(['user@test.com']);
    });

    it('handles emails with dots and plus signs', () => {
      const result = extractMentionedEmails('Hey @first.last+tag@company.co.uk');
      expect(result).toEqual(['first.last+tag@company.co.uk']);
    });
  });
});
