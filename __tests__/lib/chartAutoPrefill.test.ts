import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';

const mockColumns = [
  { name: 'id', data_type: 'integer', column_name: 'id' },
  { name: 'category', data_type: 'varchar', column_name: 'category' },
  { name: 'state', data_type: 'text', column_name: 'state' },
  { name: 'amount', data_type: 'decimal', column_name: 'amount' },
  { name: 'created_at', data_type: 'timestamp', column_name: 'created_at' },
];

describe('Chart Auto-Prefill', () => {
  describe('Bar Charts', () => {
    it('should prefill x-axis with first text column and y-axis with first number column', () => {
      const config = generateAutoPrefilledConfig('bar', mockColumns);

      expect(config.dimension_column).toBe('category');
      expect(config.aggregate_column).toBe('id');
      expect(config.aggregate_function).toBe('sum');
      expect(config.metrics).toEqual([
        {
          column: 'id',
          aggregation: 'sum',
          alias: 'id',
        },
      ]);
    });
  });

  describe('Line Charts', () => {
    it('should prefill same as bar charts', () => {
      const config = generateAutoPrefilledConfig('line', mockColumns);

      expect(config.dimension_column).toBe('category');
      expect(config.aggregate_column).toBe('id');
      expect(config.metrics).toEqual([
        {
          column: 'id',
          aggregation: 'sum',
          alias: 'id',
        },
      ]);
    });
  });

  describe('Pie Charts', () => {
    it('should prefill dimension and value columns', () => {
      const config = generateAutoPrefilledConfig('pie', mockColumns);

      expect(config.dimension_column).toBe('category');
      expect(config.aggregate_column).toBe('id');
      expect(config.aggregate_function).toBe('sum');
    });
  });

  describe('Number Charts', () => {
    it('should prefill with first numeric column', () => {
      const config = generateAutoPrefilledConfig('number', mockColumns);

      expect(config.aggregate_column).toBe('id');
      expect(config.aggregate_function).toBe('sum');
    });
  });

  describe('Map Charts', () => {
    it('should prefill with state column and first numeric column', () => {
      const config = generateAutoPrefilledConfig('map', mockColumns);

      expect(config.geographic_column).toBe('state');
      expect(config.value_column).toBe('id');
      expect(config.aggregate_column).toBe('id');
      expect(config.aggregate_function).toBe('sum');
    });

    it('should fallback to first text column if no state column found', () => {
      const columnsWithoutState = mockColumns.filter((col) => col.name !== 'state');
      const config = generateAutoPrefilledConfig('map', columnsWithoutState);

      expect(config.geographic_column).toBe('category');
    });
  });

  describe('Table Charts', () => {
    it('should prefill with first 6 columns', () => {
      const config = generateAutoPrefilledConfig('table', mockColumns);

      expect(config.table_columns).toEqual(['id', 'category', 'state', 'amount', 'created_at']);
    });

    it('should limit to first 6 columns for large datasets', () => {
      const manyColumns = Array.from({ length: 10 }, (_, i) => ({
        name: `col_${i}`,
        data_type: 'varchar',
        column_name: `col_${i}`,
      }));

      const config = generateAutoPrefilledConfig('table', manyColumns);

      expect(config.table_columns).toHaveLength(6);
      expect(config.table_columns).toEqual(['col_0', 'col_1', 'col_2', 'col_3', 'col_4', 'col_5']);
    });
  });

  describe('Edge Cases', () => {
    it('should return empty config for empty columns array', () => {
      const config = generateAutoPrefilledConfig('bar', []);

      expect(config).toEqual({});
    });

    it('should handle columns with only text data', () => {
      const textOnlyColumns = [
        { name: 'name', data_type: 'varchar', column_name: 'name' },
        { name: 'description', data_type: 'text', column_name: 'description' },
      ];

      const config = generateAutoPrefilledConfig('bar', textOnlyColumns);

      expect(config.dimension_column).toBe('name');
      expect(config.aggregate_column).toBeUndefined();
    });

    it('should handle columns with only numeric data', () => {
      const numericOnlyColumns = [
        { name: 'id', data_type: 'integer', column_name: 'id' },
        { name: 'amount', data_type: 'decimal', column_name: 'amount' },
      ];

      const config = generateAutoPrefilledConfig('bar', numericOnlyColumns);

      expect(config.dimension_column).toBeUndefined();
      expect(config.aggregate_column).toBe('id');
    });
  });
});
