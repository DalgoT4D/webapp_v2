// components/transform/canvas/utils/dummynodes.ts

import type { Node } from 'reactflow';
import type { CanvasNodeRenderData, CanvasNodeTypeEnum } from '@/types/transform';

interface GenerateDummySrcModelNodeParams {
  schema: string;
  name: string;
  type: 'source' | 'model';
  position?: { x: number; y: number };
  outputColumns?: string[];
}

/**
 * Creates a temporary source/model node for the canvas.
 * Used when user selects a secondary table in Join/Union forms
 * to show immediate visual feedback before API persistence.
 */
export function generateDummySrcModelNode({
  schema,
  name,
  type,
  position = { x: 0, y: 0 },
  outputColumns = [],
}: GenerateDummySrcModelNodeParams): Node<CanvasNodeRenderData> {
  const id = `dummy-${crypto.randomUUID()}`;

  return {
    id,
    type,
    position,
    data: {
      uuid: id,
      name: `${schema}.${name}`,
      output_columns: outputColumns,
      node_type: type as CanvasNodeTypeEnum,
      dbtmodel: { schema, name } as CanvasNodeRenderData['dbtmodel'],
      operation_config: { type: '', config: {} },
      is_last_in_chain: false,
      isPublished: null,
      isDummy: true,
    },
  };
}
