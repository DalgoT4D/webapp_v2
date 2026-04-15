import {
  JsonSchemaType,
  type AirbyteProperty,
  type AirbyteOneOfOption,
  type ConnectionSpecification,
  type ConstOption,
  type FieldGroup,
  type FieldNode,
  type ParsedSpec,
} from './types';

/**
 * Sort fields by Airbyte conventions:
 * 1. Fields with `order` first, ascending
 * 2. Among unordered: required before optional
 * 3. Alphabetically by field name as tiebreaker
 */
function sortFields(fields: FieldNode[]): FieldNode[] {
  return [...fields].sort((a, b) => {
    const aHasOrder = a.order !== undefined;
    const bHasOrder = b.order !== undefined;

    // Fields with order come first
    if (aHasOrder && bHasOrder) return a.order! - b.order!;
    if (aHasOrder) return -1;
    if (bHasOrder) return 1;

    // Among unordered: required before optional
    if (a.required !== b.required) return a.required ? -1 : 1;

    // Alphabetically by title as tiebreaker
    return a.title.localeCompare(b.title);
  });
}

/**
 * Extract the discriminator value from a property.
 * Supports both `const` and single-value `enum` (MySQL pattern).
 */
function getDiscriminatorValue(prop: AirbyteProperty): string | undefined {
  if (prop.const !== undefined) return prop.const;
  if (prop.enum && prop.enum.length === 1) return prop.enum[0];
  return undefined;
}

/**
 * Find the discriminator key in a oneOf option — the property with a `const`
 * value or a single-value `enum` (MySQL uses `enum: ["value"]` instead of `const`).
 */
function findConstKey(
  options: AirbyteOneOfOption[]
): { key: string; constOptions: ConstOption[] } | null {
  if (!options.length) return null;

  // Look through each option's properties to find the discriminator key
  for (const option of options) {
    if (!option.properties) continue;
    for (const [key, prop] of Object.entries(option.properties)) {
      const discriminatorVal = getDiscriminatorValue(prop);
      if (discriminatorVal !== undefined) {
        // Verify this key has a discriminator value in all options
        const constOptions: ConstOption[] = [];
        let allHaveConst = true;

        for (const opt of options) {
          const constProp = opt.properties?.[key];
          const val = constProp ? getDiscriminatorValue(constProp) : undefined;
          if (val !== undefined) {
            constOptions.push({
              value: val,
              title: opt.title || val,
              description: opt.description,
            });
          } else {
            allHaveConst = false;
            break;
          }
        }

        if (allHaveConst) {
          return { key, constOptions };
        }
      }
    }
  }

  return null;
}

/**
 * Parse a single field from an Airbyte property.
 */
function parseField(
  key: string,
  prop: AirbyteProperty,
  parentPath: string[],
  requiredKeys: string[]
): FieldNode | null {
  // Skip hidden fields
  if (prop.airbyte_hidden) return null;

  const path = [...parentPath, key];
  const isRequired = requiredKeys.includes(key);

  // Handle oneOf fields (type: 'object' with oneOf array)
  if (prop.oneOf && prop.oneOf.length > 0) {
    return parseOneOfField(key, prop, path, isRequired);
  }

  // Handle array fields (with or without items — missing items treated as simple string array)
  if (prop.type === JsonSchemaType.ARRAY) {
    return parseArrayField(key, prop, path, isRequired);
  }

  // Handle boolean fields
  if (prop.type === JsonSchemaType.BOOLEAN) {
    return {
      type: 'boolean',
      path,
      title: prop.title || key,
      description: prop.description,
      required: isRequired,
      hidden: false,
      order: prop.order,
      group: prop.group,
      alwaysShow: prop.always_show,
      default: prop.default,
    };
  }

  // Handle enum fields
  if (prop.enum && prop.enum.length > 0) {
    return {
      type: 'enum',
      path,
      title: prop.title || key,
      description: prop.description,
      required: isRequired,
      hidden: false,
      order: prop.order,
      group: prop.group,
      alwaysShow: prop.always_show,
      default: prop.default,
      enumValues: [...prop.enum].sort((a, b) => a.localeCompare(b)),
    };
  }

  // Handle basic fields (string, number, integer)
  const fieldType = prop.type as 'string' | 'number' | 'integer' | undefined;
  if (
    fieldType === JsonSchemaType.STRING ||
    fieldType === JsonSchemaType.NUMBER ||
    fieldType === JsonSchemaType.INTEGER
  ) {
    return {
      type: 'basic',
      path,
      title: prop.title || key,
      description: prop.description,
      required: isRequired,
      hidden: false,
      order: prop.order,
      group: prop.group,
      alwaysShow: prop.always_show,
      fieldType,
      isSecret: prop.airbyte_secret,
      isMultiline: prop.multiline,
      default: prop.default,
      pattern: prop.pattern,
      patternDescriptor: prop.pattern_descriptor,
      examples: prop.examples,
      minimum: prop.minimum,
      maximum: prop.maximum,
    };
  }

  // Fallback for unrecognized types — treat as basic string
  return {
    type: 'basic',
    path,
    title: prop.title || key,
    description: prop.description,
    required: isRequired,
    hidden: false,
    order: prop.order,
    group: prop.group,
    alwaysShow: prop.always_show,
    fieldType: JsonSchemaType.STRING,
    default: prop.default,
  };
}

/**
 * Parse a oneOf field — find the const discriminator, extract options,
 * and recursively parse sub-fields per option.
 */
function parseOneOfField(
  key: string,
  prop: AirbyteProperty,
  path: string[],
  isRequired: boolean
): FieldNode | null {
  const options = prop.oneOf!;
  const discriminator = findConstKey(options);

  // Without a discriminator we can't render a valid oneOf selector —
  // return null so the field is skipped rather than emitting a broken node.
  if (!discriminator) return null;

  const subFields: FieldNode[] = [];

  for (const option of options) {
    if (!option.properties) continue;
    const constProp = option.properties[discriminator.key];
    const constValue = constProp ? getDiscriminatorValue(constProp) : undefined;
    if (constValue === undefined) continue;

    // If the parent oneOf is not required (e.g. advanced section fields),
    // don't force sub-fields as required — they should be optional
    const optionRequired = isRequired ? option.required || [] : [];

    for (const [subKey, subProp] of Object.entries(option.properties)) {
      // Skip the discriminator field itself
      if (subKey === discriminator.key) continue;

      const subField = parseField(subKey, subProp, path, optionRequired);
      if (subField) {
        subField.parentValue = constValue;
        subFields.push(subField);
      }
    }
  }

  return {
    type: 'oneOf',
    path,
    title: prop.title || key,
    description: prop.description,
    required: isRequired,
    hidden: false,
    order: prop.order,
    group: prop.group,
    alwaysShow: prop.always_show,
    default: prop.default,
    constKey: discriminator.key,
    constOptions: discriminator.constOptions,
    oneOfSubFields: sortFields(subFields),
    displayType: prop.display_type,
  };
}

/**
 * Parse an array field — supports simple (string[]) and object arrays.
 */
function parseArrayField(
  key: string,
  prop: AirbyteProperty,
  path: string[],
  isRequired: boolean
): FieldNode {
  const items = prop.items;
  const isObjectArray = items?.type === JsonSchemaType.OBJECT && items.properties !== undefined;

  let arraySubFields: FieldNode[] = [];

  if (isObjectArray && items?.properties) {
    const itemRequired = items.required || [];
    arraySubFields = parseProperties(items.properties, path, itemRequired);
  }

  return {
    type: 'array',
    path,
    title: prop.title || key,
    description: prop.description,
    required: isRequired,
    hidden: false,
    order: prop.order,
    group: prop.group,
    alwaysShow: prop.always_show,
    default: prop.default,
    arrayItemType: isObjectArray ? 'object' : 'simple',
    arraySubFields: isObjectArray ? arraySubFields : undefined,
  };
}

/**
 * Parse a set of properties into sorted FieldNode[].
 */
function parseProperties(
  properties: Record<string, AirbyteProperty>,
  parentPath: string[],
  requiredKeys: string[]
): FieldNode[] {
  const fields: FieldNode[] = [];

  for (const [key, prop] of Object.entries(properties)) {
    const field = parseField(key, prop, parentPath, requiredKeys);
    if (field) {
      fields.push(field);
    }
  }

  return sortFields(fields);
}

/**
 * Parse an Airbyte ConnectionSpecification into a renderable ParsedSpec.
 *
 * This is the main entry point. It takes the raw JSON schema from
 * /specifications and produces a typed tree of FieldNodes ready
 * for the ConnectorConfigForm to render.
 */
export function parseAirbyteSpec(spec: ConnectionSpecification): ParsedSpec {
  const groups: FieldGroup[] = spec.groups || [];
  const requiredKeys = spec.required || [];
  const fields = parseProperties(spec.properties, [], requiredKeys);

  return { groups, fields };
}
