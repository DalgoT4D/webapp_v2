'use client';

import { FlowEditor } from '@/components/transform/ui-transform/canvas/layout/FlowEditor';

/**
 * Transform Canvas Page
 *
 * Full-page canvas editor for DBT transformations.
 * Provides drag-and-drop workflow building with:
 * - Project tree (sources/models)
 * - Visual canvas with React Flow
 * - Operation panel for configuring transforms
 * - Preview/Logs/Statistics tabs
 */
export default function TransformCanvasPage() {
  return (
    <div className="h-full w-full overflow-hidden">
      <FlowEditor />
    </div>
  );
}
