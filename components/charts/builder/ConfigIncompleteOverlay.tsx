'use client';

import type { MouseEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

/** Edit page: red "configuration incomplete" notice centered over the chart preview; click dismisses. */
export function ConfigIncompleteOverlay({ onDismiss }: { onDismiss: (e: MouseEvent) => void }) {
  return (
    <div
      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-auto cursor-pointer"
      style={{
        zIndex: 9999,
        width: '90%',
        maxWidth: '24rem',
      }}
      onClick={onDismiss}
      data-testid="chart-config-incomplete-overlay"
    >
      <Alert
        variant="destructive"
        className="shadow-2xl animate-in slide-in-from-top-2 duration-300 hover:shadow-3xl transition-all border-2 border-red-300 bg-red-50 cursor-pointer"
      >
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Please check the dataset or metric column to complete the chart configuration
          <div className="text-xs text-red-600 mt-2 font-medium">✕ Click to dismiss</div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
