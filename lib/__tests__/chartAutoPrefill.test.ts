import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';

const columns = [
  { name: 'status', column_name: 'status', data_type: 'varchar' },
  { name: 'date', column_name: 'date', data_type: 'timestamp' },
];

describe('generateAutoPrefilledConfig — pivot_table', () => {
  it('picks the first text column as row dim and the first date column as column dim', () => {
    const config = generateAutoPrefilledConfig('pivot_table', columns);
    expect(config.extra_config?.row_dimensions).toEqual(['status']);
    expect(config.extra_config?.column_dimensions).toEqual(['date']);
  });

  it('does not stamp any time-grain config on the pivot extra_config', () => {
    // Pivot time grains are not a supported feature; prefill must not add grain keys.
    const config = generateAutoPrefilledConfig('pivot_table', columns);
    const extra = config.extra_config as Record<string, unknown>;
    expect(extra?.column_time_grains).toBeUndefined();
    expect(extra?.row_time_grains).toBeUndefined();
  });
});
