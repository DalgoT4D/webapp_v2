// Hook that manages dummy (placeholder) nodes on the React Flow canvas.
// Dummy nodes are created when a user selects an operation, then swapped
// for real nodes after the operation is saved via the API.

import { useCallback, useRef } from 'react';
import { useReactFlow } from 'reactflow';
import { useTransformStore } from '@/stores/transformStore';
import { CanvasNodeTypeEnum, type UIOperationType } from '@/types/transform';
import { CANVAS_CONSTANTS } from '@/constants/transform';

export function useDummyNodeManager() {
  const { deleteElements, getNodes, setNodes, setEdges, getEdges } = useReactFlow();

  // Track dummy node for cleanup
  const dummyNodeIdRef = useRef<string | null>(null);

  // Create a dummy node positioned to the right of the currently selected node
  const createDummyNode = useCallback(
    (operation: UIOperationType) => {
      // Read selectedNode directly from the store at call time to avoid stale closures.
      // This matches v1 which reads canvasNode from context at call time.
      const currentNode = useTransformStore.getState().selectedNode;
      if (!currentNode) return;

      const dummyId = `dummy-${Date.now()}`;
      dummyNodeIdRef.current = dummyId;

      // Always read position from React Flow's live state to avoid stale values.
      const allNodes = getNodes();
      const flowNode = allNodes.find((n) => n.id === currentNode.id);
      const sourcePosition = flowNode?.position || currentNode.position || { x: 0, y: 0 };

      // Calculate target position to the right of the source node
      let targetX = sourcePosition.x + CANVAS_CONSTANTS.DAGRE_RANK_SEP;
      let targetY = sourcePosition.y;

      // Check for collisions with existing nodes at the target position.
      // When the user creates multiple operations from the same source node,
      // each new dummy must be offset vertically to avoid overlapping with
      // previously saved operation nodes.
      const COLLISION_THRESHOLD_X = 150;
      const COLLISION_THRESHOLD_Y = 150;
      const VERTICAL_OFFSET = COLLISION_THRESHOLD_Y + 30;

      for (const existingNode of allNodes) {
        if (existingNode.id === currentNode.id) continue;
        const dx = Math.abs(existingNode.position.x - targetX);
        const dy = Math.abs(existingNode.position.y - targetY);
        if (dx < COLLISION_THRESHOLD_X && dy < COLLISION_THRESHOLD_Y) {
          // Collision detected — push dummy below the conflicting node
          targetY = existingNode.position.y + VERTICAL_OFFSET;
        }
      }

      // Position to the right of the source node, matching the LR dagre layout
      const dummyNode = {
        id: dummyId,
        type: CanvasNodeTypeEnum.Operation,
        position: {
          x: targetX,
          y: targetY,
        },
        data: {
          uuid: dummyId,
          name: operation.label,
          output_columns: [] as string[],
          node_type: CanvasNodeTypeEnum.Operation,
          dbtmodel: null as null,
          operation_config: {
            type: operation.slug,
            config: {} as Record<string, unknown>,
          },
          input_nodes: [] as unknown[],
          is_last_in_chain: true,
          isPublished: null as boolean | null,
          isDummy: true,
        },
      };

      const dummyEdge = {
        id: `edge-dummy-${dummyId}`,
        source: currentNode.id,
        target: dummyId,
        type: 'default',
        animated: true,
        style: { strokeDasharray: '5,5' },
      };

      setNodes((prevNodes) => [...prevNodes, dummyNode]);
      setEdges((prevEdges) => [...prevEdges, dummyEdge]);
    },
    [setNodes, setEdges, getNodes]
  );

  // Clean up all dummy nodes and any orphan dummy edges
  const cleanupDummyNodes = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();

    const dummyNodeIds = nodes.filter((n) => n.data?.isDummy).map((n) => n.id);

    // Also find orphan dummy edges (source: edge-dummy-*) whose source/target nodes
    // may have already been removed by Canvas's setNodes after graph refresh
    const dummyEdgeIds = edges
      .filter(
        (e) =>
          dummyNodeIds.includes(e.source) ||
          dummyNodeIds.includes(e.target) ||
          e.id.startsWith('edge-dummy-')
      )
      .map((e) => e.id);

    if (dummyNodeIds.length > 0 || dummyEdgeIds.length > 0) {
      deleteElements({
        nodes: dummyNodeIds.map((id) => ({ id })),
        edges: dummyEdgeIds.map((id) => ({ id })),
      });
    }

    dummyNodeIdRef.current = null;
  }, [getNodes, getEdges, deleteElements]);

  // Swap a dummy node for a real node (after API save), preserving position.
  // Returns true if swap happened, false if cleanup-only was needed.
  const swapDummyForRealNode = useCallback(
    (newNodeUuid: string): boolean => {
      const dummyId = dummyNodeIdRef.current;

      if (!dummyId || newNodeUuid === dummyId) {
        // Edit mode or no dummy — just clean up
        cleanupDummyNodes();
        return false;
      }

      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const dummyNode = currentNodes.find((n) => n.id === dummyId);
      const dummyEdges = currentEdges.filter((e) => e.source === dummyId || e.target === dummyId);

      if (!dummyNode) {
        cleanupDummyNodes();
        return false;
      }

      const realNode = {
        id: newNodeUuid,
        type: CanvasNodeTypeEnum.Operation as string,
        position: { ...dummyNode.position },
        data: {
          ...dummyNode.data,
          uuid: newNodeUuid,
          isDummy: false,
        },
      };

      // Remap edges from dummy → real node
      const realEdges = dummyEdges.map((edge) => {
        const source = edge.source === dummyId ? newNodeUuid : edge.source;
        const target = edge.target === dummyId ? newNodeUuid : edge.target;
        return {
          id: `${source}_${target}`,
          source,
          target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
        };
      });

      // Swap: remove dummy, add real node + remapped edges
      setNodes((prev) => [...prev.filter((n) => n.id !== dummyId), realNode]);
      setEdges((prev) => [
        ...prev.filter((e) => !dummyEdges.some((de) => de.id === e.id)),
        ...realEdges,
      ]);

      dummyNodeIdRef.current = null;
      return true;
    },
    [getNodes, getEdges, setNodes, setEdges, cleanupDummyNodes]
  );

  return {
    dummyNodeIdRef,
    createDummyNode,
    cleanupDummyNodes,
    swapDummyForRealNode,
  };
}
