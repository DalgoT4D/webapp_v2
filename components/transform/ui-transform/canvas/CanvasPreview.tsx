// components/transform/canvas/CanvasPreview.tsx
'use client';

import { ReactFlowProvider } from 'reactflow';
import Canvas from './Canvas';

/**
 * CanvasPreview - Read-only wrapper for the Canvas component
 *
 * Used for preview/read-only display of transformation workflows.
 * Features:
 * - No lock acquisition
 * - No editing capabilities
 * - Simpler header (no Run/Publish buttons)
 */
export default function CanvasPreview() {
  return (
    <ReactFlowProvider>
      <Canvas isPreviewMode={true} />
    </ReactFlowProvider>
  );
}
