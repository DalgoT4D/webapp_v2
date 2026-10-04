'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, ChevronDown } from 'lucide-react';

export interface SaveToLibrarySectionProps {
  index: number;
  mode: 'simple' | 'calculated' | 'saved';
  schemaName?: string;
  tableName?: string;
  disabled?: boolean;
  saving?: boolean;
  onSaveToLibrary?: (metricName: string, mode: 'simple' | 'calculated') => void;
}

/**
 * Save-to-library — only for the editable (Simple / Calculated) modes. Owns its own "Metric
 * Name" draft and expand/collapse toggle, both purely local to this row's collapsible section.
 */
export function SaveToLibrarySection({
  index,
  mode,
  schemaName,
  tableName,
  disabled,
  saving,
  onSaveToLibrary,
}: SaveToLibrarySectionProps) {
  const [metricName, setMetricName] = React.useState('');
  const [showSaveSection, setShowSaveSection] = React.useState(false);

  if (mode === 'saved' || !schemaName || !tableName || !onSaveToLibrary) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
        onClick={() => setShowSaveSection(!showSaveSection)}
        data-testid={`metric-save-toggle-${index}`}
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${showSaveSection ? '' : '-rotate-90'}`}
        />
        Add metric to library
      </button>
      {showSaveSection && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Metric Name *</Label>
            <Input
              data-testid={`metric-save-name-${index}`}
              value={metricName}
              onChange={(e) => setMetricName(e.target.value)}
              placeholder="Give a unique name"
              className="h-8 text-sm"
              disabled={disabled}
            />
          </div>
          <Button
            size="sm"
            onClick={() =>
              onSaveToLibrary(metricName, mode === 'calculated' ? 'calculated' : 'simple')
            }
            disabled={disabled || !metricName.trim() || saving}
            data-testid={`metric-save-btn-${index}`}
            className="w-full h-8 text-xs bg-gray-900 text-white hover:bg-gray-700"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            ADD METRIC TO LIBRARY
          </Button>
        </div>
      )}
    </div>
  );
}
