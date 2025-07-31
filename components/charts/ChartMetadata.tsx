'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Add notes or context about this chart"
          disabled={disabled}
          rows={3}
        />
      </div>
    </div>
  );
}
