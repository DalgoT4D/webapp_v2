import { PRESET_COLORS, CONDITIONAL_OPERATORS, HEX_COLOR_REGEX } from '../constants';

describe('Table chart constants', () => {
  it('has exactly 8 preset colors', () => {
    expect(PRESET_COLORS).toHaveLength(8);
  });

  it('all preset colors are valid hex codes', () => {
    PRESET_COLORS.forEach((color) => {
      expect(color.hex).toMatch(HEX_COLOR_REGEX);
    });
  });

  it('has all 6 conditional operators', () => {
    const operators = CONDITIONAL_OPERATORS.map((op) => op.value);
    expect(operators).toEqual(['>', '<', '>=', '<=', '==', '!=']);
  });

  it('HEX_COLOR_REGEX validates correctly', () => {
    expect(HEX_COLOR_REGEX.test('#C8E6C9')).toBe(true);
    expect(HEX_COLOR_REGEX.test('#c8e6c9')).toBe(true);
    expect(HEX_COLOR_REGEX.test('#FFF')).toBe(false);
    expect(HEX_COLOR_REGEX.test('C8E6C9')).toBe(false);
    expect(HEX_COLOR_REGEX.test('#ZZZZZZ')).toBe(false);
  });
});
