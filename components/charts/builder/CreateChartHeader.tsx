'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DashboardNameHint } from '@/components/onboarding/dashboard-name-hint';

interface CreateChartHeaderProps {
  isFromDashboard: boolean;
  title: string | undefined;
  onTitleChange: (title: string) => void;
  onBack: () => void;
  onSave: () => void;
  canSave: boolean;
  isSaving: boolean;
}

/** Create page header: Back, chart name (with the onboarding hint) and Save. */
export function CreateChartHeader({
  isFromDashboard,
  title,
  onTitleChange,
  onBack,
  onSave,
  canSave,
  isSaving,
}: CreateChartHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Back Button */}
        <Button data-testid="chart-create-back-button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {isFromDashboard ? 'Back to Dashboard' : 'Back'}
        </Button>

        {/* Chart Title Input */}
        <div className="space-y-1">
          <Label htmlFor="chart-name" className="flex items-center gap-2">
            Chart name
            <DashboardNameHint id="chart-name-guidance" />
          </Label>
          <Input
            id="chart-name"
            data-testid="chart-name-input"
            aria-describedby="chart-name-guidance"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="h-11 min-w-[300px] border border-gray-200 bg-white px-4 py-2 text-lg font-semibold shadow-sm"
            placeholder="Untitled Chart"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          data-testid="chart-edit-save-button"
          onClick={onSave}
          variant="primary"
          disabled={!canSave || isSaving}
          className="px-8 h-11"
        >
          {isSaving ? 'Saving...' : 'Save Chart'}
        </Button>
      </div>
    </div>
  );
}
