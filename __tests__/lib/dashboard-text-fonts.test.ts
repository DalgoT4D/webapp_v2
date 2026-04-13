import {
  getDashboardTextFontSelectValue,
  resolveDashboardTextFontFamily,
  resolveDashboardTextFontOption,
} from '@/lib/dashboard-text-fonts';

describe('dashboard text fonts', () => {
  it('resolves stable font ids to the expected css font stacks', () => {
    expect(resolveDashboardTextFontFamily('inter')).toBe('var(--font-inter), sans-serif');
    expect(resolveDashboardTextFontFamily('playfair-display')).toBe(
      'var(--font-playfair-display), serif'
    );
  });

  it('maps legacy saved font-family strings back to the supported options', () => {
    expect(resolveDashboardTextFontOption('Inter, system-ui, sans-serif')?.value).toBe('inter');
    expect(getDashboardTextFontSelectValue('var(--font-pt-serif), serif')).toBe('pt-serif');
  });

  it('falls back cleanly for unknown or empty values', () => {
    expect(resolveDashboardTextFontFamily('')).toBeUndefined();
    expect(getDashboardTextFontSelectValue('custom-font-stack')).toBe('');
  });
});
