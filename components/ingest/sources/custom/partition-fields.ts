import type { FieldNode } from '@/components/connectors/types';

export interface PartitionOpts {
  /** Field keys forced into primary even when not required. */
  pinned?: string[];
  /** Field keys omitted entirely because a custom widget renders them. */
  exclude?: string[];
}

function keyOf(field: FieldNode): string {
  return field.path[field.path.length - 1];
}

/**
 * Split spec fields into primary (required OR pinned) and advanced (the rest).
 * Input order is preserved; excluded keys appear in neither group.
 */
export function partitionFields(
  fields: FieldNode[],
  opts: PartitionOpts = {}
): { primary: FieldNode[]; advanced: FieldNode[] } {
  const pinned = new Set(opts.pinned ?? []);
  const exclude = new Set(opts.exclude ?? []);
  const primary: FieldNode[] = [];
  const advanced: FieldNode[] = [];

  for (const field of fields) {
    const key = keyOf(field);
    if (exclude.has(key)) continue;
    if (field.required || pinned.has(key)) primary.push(field);
    else advanced.push(field);
  }

  return { primary, advanced };
}
