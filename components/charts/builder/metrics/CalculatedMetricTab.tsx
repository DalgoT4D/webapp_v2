'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

export interface CalculatedMetricTabProps {
  index: number;
  exprDraft: string;
  onExprChange: (value: string) => void;
  // Fired on blur — the caller validates + commits the (debounced) expression there.
  onBlur: () => void;
  validating: boolean;
  exprError: string | null;
  disabled?: boolean;
}

/** Body of the Calculated tab — a free-form SQL expression, validated + committed on blur/debounce. */
export function CalculatedMetricTab({
  index,
  exprDraft,
  onExprChange,
  onBlur,
  validating,
  exprError,
  disabled,
}: CalculatedMetricTabProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-600">Expression *</Label>
      <Textarea
        data-testid={`metric-expr-${index}`}
        value={exprDraft}
        onChange={(e) => onExprChange(e.target.value)}
        onBlur={onBlur}
        placeholder="Add an expression eg. SUM(column_name)/10"
        rows={2}
        className="font-mono text-sm"
        disabled={disabled}
      />
      {validating && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Validating expression...</span>
        </div>
      )}
      {exprError && <p className="text-xs text-destructive">{exprError}</p>}
    </div>
  );
}
