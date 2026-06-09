// JSON Schema primitive types as used by Airbyte connector specifications
export enum JsonSchemaType {
  STRING = 'string',
  NUMBER = 'number',
  INTEGER = 'integer',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
}

// ============ Raw Airbyte JSON Schema Types ============

export interface AirbyteProperty {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  examples?: unknown[];
  enum?: string[];
  const?: string;
  pattern?: string;
  pattern_descriptor?: string;
  minimum?: number;
  maximum?: number;
  order?: number;
  group?: string;
  airbyte_secret?: boolean;
  airbyte_hidden?: boolean;
  multiline?: boolean;
  display_type?: 'dropdown' | 'radio';
  always_show?: boolean;
  oneOf?: AirbyteOneOfOption[];
  properties?: Record<string, AirbyteProperty>;
  required?: string[];
  items?: AirbyteProperty;
  format?: string;
}

export interface AirbyteOneOfOption {
  title?: string;
  description?: string;
  properties?: Record<string, AirbyteProperty>;
  required?: string[];
}

export interface ConnectionSpecification {
  type: string;
  title?: string;
  description?: string;
  properties: Record<string, AirbyteProperty>;
  required?: string[];
  groups?: FieldGroup[];
}

// ============ Parsed Output Types ============

export interface FieldGroup {
  id: string;
  title?: string;
}

export type FieldType = 'basic' | 'boolean' | 'enum' | 'oneOf' | 'array';

export interface ConstOption {
  value: string;
  title: string;
  description?: string;
}

export interface FieldNode {
  type: FieldType;
  path: string[]; // e.g., ['config', 'credentials', 'client_id']
  title: string;
  description?: string;
  required: boolean;
  hidden: boolean; // airbyte_hidden
  order?: number;
  group?: string;
  alwaysShow?: boolean; // always_show from spec — keeps optional fields visible
  parentValue?: string; // links sub-fields to their parent oneOf option

  // Basic fields
  fieldType?: 'string' | 'number' | 'integer';
  isSecret?: boolean; // airbyte_secret
  isMultiline?: boolean; // multiline: true
  default?: unknown;
  pattern?: string;
  patternDescriptor?: string;
  examples?: unknown[];
  minimum?: number;
  maximum?: number;

  // Enum fields
  enumValues?: string[];

  // OneOf fields
  constKey?: string; // discriminator field name (e.g., "auth_type")
  constOptions?: ConstOption[];
  oneOfSubFields?: FieldNode[]; // sub-fields tagged with parentValue
  displayType?: 'dropdown' | 'radio';

  // Array fields
  arrayItemType?: 'simple' | 'object';
  arraySubFields?: FieldNode[]; // fields inside each object item
}

export interface ParsedSpec {
  groups: FieldGroup[];
  fields: FieldNode[];
}
