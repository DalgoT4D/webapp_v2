import type { ChartBuilderFormData } from '@/types/charts';

interface TableColumn {
  name: string;
  data_type: string;
  column_name: string;
}

const isTextColumn = (dataType: string) => {
  const type = dataType.toLowerCase();
  return type.includes('varchar') || type.includes('text') || type.includes('char');
};

const isNumberColumn = (dataType: string) => {
  const type = dataType.toLowerCase();
  return (
    type.includes('integer') ||
    type.includes('decimal') ||
    type.includes('numeric') ||
    type.includes('float') ||
    type.includes('double') ||
    type.includes('bigint')
  );
};

const findStateColumn = (columns: TableColumn[]) => {
  return (
    columns.find((col) => col.name?.toLowerCase().includes('state')) ||
    columns.find((col) => isTextColumn(col.data_type))
  );
};

export function generateAutoPrefilledConfig(
  chartType: ChartBuilderFormData['chart_type'],
  columns: TableColumn[]
): Partial<ChartBuilderFormData> {
  if (!columns || columns.length === 0) return {};

  const textColumn = columns.find((col) => col.name && isTextColumn(col.data_type));
  const numberColumn = columns.find((col) => col.name && isNumberColumn(col.data_type));

  const config: Partial<ChartBuilderFormData> = {};

  switch (chartType) {
    case 'bar':
    case 'line':
      if (textColumn) config.dimension_column = textColumn.name;
      // Always add count metric as default
      config.aggregate_function = 'count';
      config.metrics = [
        {
          column: null,
          aggregation: 'count',
          alias: 'Total Count',
        },
      ];
      break;

    case 'pie':
      if (textColumn) config.dimension_column = textColumn.name;
      // Always add count metric as default for pie charts
      config.aggregate_function = 'count';
      config.metrics = [
        {
          column: null,
          aggregation: 'count',
          alias: 'Total Count',
        },
      ];
      break;

    case 'number':
      // Always add count metric as default for number charts
      config.aggregate_function = 'count';
      config.metrics = [
        {
          column: null,
          aggregation: 'count',
          alias: 'Total Count',
        },
      ];
      break;

    case 'map':
      const stateColumn = findStateColumn(columns);
      if (stateColumn) config.geographic_column = stateColumn.name;
      // Always add count metric as default for maps
      config.aggregate_function = 'count';
      config.metrics = [
        {
          column: null,
          aggregation: 'count',
          alias: 'Total Count',
        },
      ];
      break;

    case 'table':
      if (textColumn) config.dimension_column = textColumn.name;
      // Always add count metric as default for tables
      config.metrics = [
        {
          column: null,
          aggregation: 'count',
          alias: 'Total Count',
        },
      ];
      config.table_columns = columns
        .slice(0, 6)
        .filter((col) => col.name)
        .map((col) => col.name);
      break;
  }

  return config;
}
