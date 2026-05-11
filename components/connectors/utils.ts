import { JsonSchemaType, type FieldNode, type ParsedSpec } from './types';

/**
 * Navigate into a nested object following the given path segments,
 * returning the parent object and the final key. Returns null if
 * any intermediate segment is not an object.
 */
function resolveNestedPath(
  root: Record<string, unknown>,
  path: string[]
): { parent: Record<string, unknown>; key: string } | null {
  if (path.length === 0) return null;

  let current = root;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (
      current[segment] === undefined ||
      current[segment] === null ||
      typeof current[segment] !== 'object'
    ) {
      return null;
    }
    current = current[segment] as Record<string, unknown>;
  }

  return { parent: current, key: path[path.length - 1] };
}

/**
 * Walk the parsed spec and coerce string values to numbers where
 * the spec expects integer/number fields. HTML inputs always return strings,
 * so this ensures correct types before sending to the API.
 *
 * Also removes empty start_date (common pattern in Airbyte sources).
 */
export function cleanFormValues(
  values: Record<string, unknown>,
  fields: FieldNode[]
): Record<string, unknown> {
  const cleaned = structuredClone(values);

  function walk(fieldList: FieldNode[]) {
    for (const field of fieldList) {
      const resolved = resolveNestedPath(cleaned, field.path);
      if (!resolved || !(resolved.key in resolved.parent)) continue;

      if (
        (field.fieldType === JsonSchemaType.INTEGER || field.fieldType === JsonSchemaType.NUMBER) &&
        typeof resolved.parent[resolved.key] === 'string'
      ) {
        const raw = (resolved.parent[resolved.key] as string).trim();
        if (raw === '') {
          // Empty string on a number field means "not provided" — remove it
          // so Airbyte doesn't see 0 for optional fields with minimum constraints
          delete resolved.parent[resolved.key];
        } else {
          const num = Number(raw);
          if (!isNaN(num)) {
            resolved.parent[resolved.key] =
              field.fieldType === JsonSchemaType.INTEGER ? Math.round(num) : num;
          }
        }
      }

      // Recurse into oneOf sub-fields
      if (field.oneOfSubFields) {
        walk(field.oneOfSubFields);
      }

      // Recurse into array sub-fields (for each item in the array)
      if (field.arraySubFields && field.type === 'array') {
        const arr = resolved.parent[resolved.key];
        if (Array.isArray(arr)) {
          for (let i = 0; i < arr.length; i++) {
            if (typeof arr[i] === 'object' && arr[i] !== null) {
              for (const subField of field.arraySubFields) {
                // Rewrite sub-field paths relative to the array item
                const relativeKey = subField.path[subField.path.length - 1];
                const itemObj = arr[i] as Record<string, unknown>;
                if (relativeKey in itemObj) {
                  if (
                    (subField.fieldType === JsonSchemaType.INTEGER ||
                      subField.fieldType === JsonSchemaType.NUMBER) &&
                    typeof itemObj[relativeKey] === 'string'
                  ) {
                    const raw = (itemObj[relativeKey] as string).trim();
                    if (raw === '') {
                      delete itemObj[relativeKey];
                    } else {
                      const num = Number(raw);
                      if (!isNaN(num)) {
                        itemObj[relativeKey] =
                          subField.fieldType === JsonSchemaType.INTEGER ? Math.round(num) : num;
                      }
                    }
                  }
                }
                // Recurse into nested oneOf within array items
                if (subField.oneOfSubFields) {
                  walk(
                    subField.oneOfSubFields.map((sf) => ({
                      ...sf,
                      path: [...field.path, String(i), ...sf.path.slice(field.path.length)],
                    }))
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  walk(fields);

  // Remove empty start_date (common pattern in Airbyte sources)
  if (
    cleaned.start_date === '' ||
    cleaned.start_date === null ||
    cleaned.start_date === undefined
  ) {
    delete cleaned.start_date;
  }

  // Remove flat dot-notation keys that RHF may leave alongside nested values.
  // e.g. "credentials.auth_type" should not coexist with credentials: { auth_type: ... }
  for (const key of Object.keys(cleaned)) {
    if (key.includes('.')) {
      delete cleaned[key];
    }
  }

  return cleaned;
}

/**
 * Set a value at a nested path inside an object, creating intermediate
 * objects as needed.  e.g. setNested(obj, ['a','b','c'], 1) → obj.a.b.c = 1
 */
function setNested(root: Record<string, unknown>, path: string[], value: unknown): void {
  let current = root;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (
      !current[segment] ||
      typeof current[segment] !== 'object' ||
      Array.isArray(current[segment])
    ) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

/**
 * Extract default values from a parsed spec so that React Hook Form
 * knows about spec defaults at validation time (not just at render time
 * via Controller's defaultValue prop).
 *
 * Handles basic fields, boolean fields, enum fields, and oneOf
 * discriminator values (e.g. tunnel_method.tunnel_method = "NO_TUNNEL").
 *
 * Returns a properly nested object (not flat dot-notation keys) so that
 * RHF's reset() populates the correct paths for Controller fields.
 */
export function extractSpecDefaults(parsedSpec: ParsedSpec): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  function walk(fields: FieldNode[]) {
    for (const field of fields) {
      if (field.type === 'oneOf' && field.constKey && field.constOptions?.length) {
        // Set the discriminator to the first option (or field.default if present)
        const discriminatorPath = [...field.path, field.constKey];
        const defaultOption =
          typeof field.default === 'string' ? field.default : field.constOptions[0].value;
        setNested(defaults, discriminatorPath, defaultOption);

        // Also walk sub-fields for the default option to pick up their defaults
        if (field.oneOfSubFields) {
          const defaultSubFields = field.oneOfSubFields.filter(
            (f) => f.parentValue === defaultOption
          );
          walk(defaultSubFields);
        }
      } else if (field.default !== undefined) {
        setNested(defaults, field.path, field.default);
      }

      // Recurse into non-oneOf sub-fields
      if (field.type !== 'oneOf' && field.oneOfSubFields) {
        walk(field.oneOfSubFields);
      }
      // Do NOT recurse into arraySubFields — their defaults are per-item
      // templates handled by each Controller's defaultValue when items are
      // added. Setting them here would turn the array field (e.g. streams)
      // into an object with keys like globs, format, etc.
    }
  }

  walk(parsedSpec.fields);
  return defaults;
}
