import { generateDuplicateTitle } from '@/lib/form-utils';

describe('generateDuplicateTitle', () => {
  it('prefixes "Copy of" when free', () => {
    expect(generateDuplicateTitle('Students', [])).toBe('Copy of Students');
  });

  it('numbers from 2 when the copy exists', () => {
    expect(generateDuplicateTitle('Students', ['Copy of Students'])).toBe('Copy of Students (2)');
    expect(generateDuplicateTitle('Students', ['Copy of Students', 'Copy of Students (2)'])).toBe(
      'Copy of Students (3)'
    );
  });

  it('duplicating a copy keeps a single "Copy of"', () => {
    expect(generateDuplicateTitle('Copy of Students', [])).toBe('Copy of Students');
    expect(generateDuplicateTitle('Copy of Students', ['Copy of Students'])).toBe(
      'Copy of Students (2)'
    );
  });

  it('a numbered copy restarts numbering from its base title (current behavior)', () => {
    // "Copy of Students (2)" exists → base "Students", tries (2) (taken) then (3)
    expect(generateDuplicateTitle('Copy of Students (2)', ['Copy of Students (2)'])).toBe(
      'Copy of Students (3)'
    );
  });
});
