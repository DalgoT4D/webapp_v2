'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { ChartBuilderFormData } from '@/types/charts';

interface ChartMetadataProps {
  formData: ChartBuilderFormData;
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

export function ChartMetadata({ formData, onChange, disabled }: ChartMetadataProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Chart Title *</Label>
        <Input
          id="title"
          value={formData.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Enter a descriptive title for your chart"
          disabled={disabled}
          required
        />
      </div>
    </div>
  );
}
