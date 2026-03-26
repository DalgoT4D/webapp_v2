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
