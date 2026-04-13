export interface DashboardTextFontOption {
  label: string;
  value: string;
  category: 'default' | 'sans-serif' | 'serif';
  fontFamily?: string;
  aliases?: readonly string[];
}

export const DASHBOARD_TEXT_FONT_OPTIONS: readonly DashboardTextFontOption[] = [
  { label: 'System Default', value: '', category: 'default' },
  {
    label: 'Anek Latin',
    value: 'anek-latin',
    category: 'sans-serif',
    fontFamily: 'var(--font-anek-latin), sans-serif',
    aliases: ['anek latin', 'var(--font-anek-latin), sans-serif'],
  },
  {
    label: 'Inter',
    value: 'inter',
    category: 'sans-serif',
    fontFamily: 'var(--font-inter), sans-serif',
    aliases: ['inter', 'var(--font-inter), sans-serif', 'Inter, system-ui, sans-serif'],
  },
  {
    label: 'Farsan',
    value: 'farsan',
    category: 'sans-serif',
    fontFamily: 'var(--font-farsan), cursive',
    aliases: ['farsan', 'var(--font-farsan), cursive'],
  },
  {
    label: 'PT Serif',
    value: 'pt-serif',
    category: 'serif',
    fontFamily: 'var(--font-pt-serif), serif',
    aliases: ['pt serif', 'var(--font-pt-serif), serif'],
  },
  {
    label: 'Merriweather',
    value: 'merriweather',
    category: 'serif',
    fontFamily: 'var(--font-merriweather), serif',
    aliases: ['merriweather', 'var(--font-merriweather), serif'],
  },
  {
    label: 'Playfair Display',
    value: 'playfair-display',
    category: 'serif',
    fontFamily: 'var(--font-playfair-display), serif',
    aliases: ['playfair display', 'var(--font-playfair-display), serif'],
  },
];

function normalizeFontToken(value: string | null | undefined) {
  return value?.trim().toLowerCase() || '';
}

const dashboardTextFontLookup = new Map<string, DashboardTextFontOption>();

for (const option of DASHBOARD_TEXT_FONT_OPTIONS) {
  const aliases = [option.value, option.fontFamily, option.label, ...(option.aliases || [])];

  for (const alias of aliases) {
    const normalizedAlias = normalizeFontToken(alias);

    if (normalizedAlias && !dashboardTextFontLookup.has(normalizedAlias)) {
      dashboardTextFontLookup.set(normalizedAlias, option);
    }
  }
}

export function resolveDashboardTextFontOption(value: string | null | undefined) {
  const normalizedValue = normalizeFontToken(value);

  if (!normalizedValue) {
    return DASHBOARD_TEXT_FONT_OPTIONS[0];
  }

  return dashboardTextFontLookup.get(normalizedValue) || null;
}

export function resolveDashboardTextFontFamily(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return undefined;
  }

  return resolveDashboardTextFontOption(trimmedValue)?.fontFamily || trimmedValue;
}

export function getDashboardTextFontSelectValue(value: string | null | undefined) {
  return resolveDashboardTextFontOption(value)?.value || '';
}
