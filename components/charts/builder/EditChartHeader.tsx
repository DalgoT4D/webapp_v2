'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EditChartHeaderProps {
  backLabel: string;
  title: string | undefined;
  onTitleChange: (title: string) => void;
  onBack: () => void;
  onCancel: () => void;
  onSave: () => void;
  canSave: boolean;
  /** An update or a save-as-new request is in flight. */
  isBusy: boolean;
}

/** Edit page header: origin-aware Back, chart name, Cancel and Save. */
export function EditChartHeader({
  backLabel,
  title,
  onTitleChange,
  onBack,
  onCancel,
  onSave,
  canSave,
  isBusy,
}: EditChartHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Back Button */}
        <Button data-testid="chart-edit-back-button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {backLabel}
        </Button>

        {/* Chart Title Input */}
        <Input
          data-testid="chart-name-input"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="text-lg font-semibold border border-gray-200 shadow-sm px-4 py-2 h-11 bg-white min-w-[300px]"
          placeholder="Untitled Chart"
        />
      </div>

      <div className="flex items-center gap-4">
        <Button
          data-testid="chart-edit-cancel-button"
          variant="cancel"
          onClick={onCancel}
          disabled={isBusy}
          className="px-8 h-11"
        >
          Cancel
        </Button>
        <Button
          data-testid="chart-edit-save-button"
          onClick={onSave}
          variant="primary"
          disabled={!canSave || isBusy}
          className="px-8 h-11"
        >
          {isBusy ? 'Saving...' : 'Save Chart'}
        </Button>
      </div>
    </div>
  );
}
