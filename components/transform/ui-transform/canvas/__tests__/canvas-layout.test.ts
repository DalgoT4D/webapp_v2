import type { Edge, Node } from 'reactflow';
import { CanvasNodeTypeEnum, type CanvasNodeRenderData } from '@/types/transform';
import {
  dagreCenterToTopLeft,
  getLayoutedElements,
  getNodeDimensions,
} from '../utils/canvas-layout';
import { getAutoArrangedCanvas, resolveCanvasElements } from '../utils/canvas-state';
import { createMockEdge, createMockOperationNode, createMockSourceNode } from './canvas-mock-data';

describe('canvas layout coordinate contract', () => {
  it('converts Dagre centers to React Flow top-left positions', () => {
    expect(dagreCenterToTopLeft({ x: 500, y: 300 }, { width: 200, height: 100 })).toEqual({
      x: 400,
      y: 250,
    });
  });

  it('uses type-specific fallback dimensions before React Flow measures nodes', () => {
    const source = {
      id: 'source',
      type: CanvasNodeTypeEnum.Source,
      data: createMockSourceNode(),
      position: { x: 0, y: 0 },
    } as Node;
    const operation = {
      id: 'operation',
      type: CanvasNodeTypeEnum.Operation,
      data: createMockOperationNode('where'),
      position: { x: 0, y: 0 },
    } as Node;

    expect(getNodeDimensions(source)).toEqual({ width: 250, height: 68 });
    expect(getNodeDimensions(operation)).toEqual({ width: 96, height: 96 });
  });

  it('lays out connected nodes without reusing Dagre center coordinates as top-left', () => {
    const source = {
      id: 'source',
      type: CanvasNodeTypeEnum.Source,
      data: { ...createMockSourceNode(), isDummy: false },
      position: { x: 0, y: 0 },
    } as Node;
    const operation = {
      id: 'operation',
      type: CanvasNodeTypeEnum.Operation,
      data: { ...createMockOperationNode('where'), isDummy: false },
      position: { x: 0, y: 0 },
    } as Node;

    const result = getLayoutedElements(
      [source, operation],
      [{ id: 'source_operation', source: 'source', target: 'operation' }]
    );

    expect(result.nodes[0].position.x).toBe(100);
    expect(result.nodes[0].position.y).toBeGreaterThanOrEqual(100);
    expect(result.nodes[1].position.x).toBeGreaterThan(result.nodes[0].position.x);
  });
});

describe('canvas persistence state resolution', () => {
  it('hydrates saved top-left positions without scheduling another initialization save', () => {
    const source = createMockSourceNode({
      uuid: 'source',
      position: { x: -125.5, y: 240.25 },
    });

    const result = resolveCanvasElements({
      apiNodes: [source],
      apiEdges: [],
      currentNodes: [],
      currentEdges: [],
    });

    expect(result.nodes[0].position).toEqual({ x: -125.5, y: 240.25 });
    expect(result.initialPositionUpdates).toEqual([]);
  });

  it('initializes legacy nodes with Dagre positions that can be persisted', () => {
    const source = createMockSourceNode({ uuid: 'source', position: null });
    const operation = createMockOperationNode('where', {}, { uuid: 'operation', position: null });

    const result = resolveCanvasElements({
      apiNodes: [source, operation],
      apiEdges: [createMockEdge('source', 'operation', { id: 'server-edge' })],
      currentNodes: [],
      currentEdges: [],
    });

    expect(result.initialPositionUpdates).toHaveLength(2);
    expect(result.initialPositionUpdates.map((update) => update.uuid)).toEqual([
      'source',
      'operation',
    ]);
    expect(result.nodes.find((node) => node.id === 'operation')!.position.x).toBeGreaterThan(
      result.nodes.find((node) => node.id === 'source')!.position.x
    );
  });

  it('preserves a live existing position when a new graph node is added', () => {
    const source = createMockSourceNode({
      uuid: 'source',
      position: { x: 50, y: 60 },
    });
    const operation = createMockOperationNode('where', {}, { uuid: 'operation', position: null });
    const liveSource = {
      id: 'source',
      type: CanvasNodeTypeEnum.Source,
      data: { ...source, isDummy: false },
      position: { x: 200, y: 300 },
    } as Node<CanvasNodeRenderData>;

    const result = resolveCanvasElements({
      apiNodes: [source, operation],
      apiEdges: [createMockEdge('source', 'operation', { id: 'server-edge' })],
      currentNodes: [liveSource],
      currentEdges: [],
    });

    expect(result.nodes.find((node) => node.id === 'source')!.position).toEqual({ x: 200, y: 300 });
    expect(result.initialPositionUpdates).toEqual([expect.objectContaining({ uuid: 'operation' })]);
  });

  it('retains dummy guidance but drops unsupported local-only solid connections', () => {
    const source = createMockSourceNode({ uuid: 'source', position: { x: 10, y: 20 } });
    const operation = createMockOperationNode(
      'where',
      {},
      { uuid: 'operation', position: { x: 400, y: 20 } }
    );
    const dummyNode = {
      id: 'dummy-operation',
      type: CanvasNodeTypeEnum.Operation,
      data: { ...operation, uuid: 'dummy-operation', isDummy: true },
      position: { x: 700, y: 20 },
    } as Node<CanvasNodeRenderData>;
    const currentEdges: Edge[] = [
      { id: 'manual-solid-edge', source: 'source', target: 'operation' },
      {
        id: 'edge-dummy-operation',
        source: 'operation',
        target: 'dummy-operation',
        animated: true,
      },
    ];

    const result = resolveCanvasElements({
      apiNodes: [source, operation],
      apiEdges: [createMockEdge('source', 'operation', { id: 'server-edge' })],
      currentNodes: [dummyNode],
      currentEdges,
    });

    expect(result.nodes.map((node) => node.id)).toContain('dummy-operation');
    expect(result.edges.map((edge) => edge.id)).toEqual(['server-edge', 'edge-dummy-operation']);
    expect(result.initialPositionUpdates).toEqual([]);
  });

  it('auto-arranges and persists only real nodes', () => {
    const sourceData = createMockSourceNode({ uuid: 'source', position: { x: 10, y: 20 } });
    const operationData = createMockOperationNode(
      'where',
      {},
      { uuid: 'operation', position: { x: 20, y: 20 } }
    );
    const source = {
      id: 'source',
      type: CanvasNodeTypeEnum.Source,
      data: { ...sourceData, isDummy: false },
      position: sourceData.position!,
    } as Node<CanvasNodeRenderData>;
    const operation = {
      id: 'operation',
      type: CanvasNodeTypeEnum.Operation,
      data: { ...operationData, isDummy: false },
      position: operationData.position!,
    } as Node<CanvasNodeRenderData>;
    const dummy = {
      ...operation,
      id: 'dummy',
      data: { ...operation.data, uuid: 'dummy', isDummy: true },
    } as Node<CanvasNodeRenderData>;

    const result = getAutoArrangedCanvas(
      [source, operation, dummy],
      [
        { id: 'server-edge', source: 'source', target: 'operation' },
        { id: 'dummy-edge', source: 'operation', target: 'dummy', animated: true },
      ]
    );

    expect(result.nodes.map((node) => node.id)).toEqual(['source', 'operation']);
    expect(result.updates.map((update) => update.uuid)).toEqual(['source', 'operation']);
  });
});
