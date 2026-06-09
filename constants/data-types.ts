export const NumericDataType = {
  INTEGER: 'integer',
  SMALLINT: 'smallint',
  BIGINT: 'bigint',
  NUMERIC: 'numeric',
  DOUBLE_PRECISION: 'double precision',
  REAL: 'real',
  FLOAT: 'float',
  DECIMAL: 'decimal',
} as const;

export type NumericDataTypeValue = (typeof NumericDataType)[keyof typeof NumericDataType];

export const DateDataType = {
  DATE: 'date',
  TIMESTAMP: 'timestamp',
  TIMESTAMP_WITHOUT_TZ: 'timestamp without time zone',
  TIMESTAMP_WITH_TZ: 'timestamp with time zone',
  TIMESTAMPTZ: 'timestamptz',
  TIME: 'time',
  TIME_WITHOUT_TZ: 'time without time zone',
  TIME_WITH_TZ: 'time with time zone',
  TIMETZ: 'timetz',
} as const;

export type DateDataTypeValue = (typeof DateDataType)[keyof typeof DateDataType];
