'use client';

import React, { useState } from 'react';
import { Controller } from 'react-hook-form';
import type { Control, UseFormRegister, UseFormWatch, FieldErrors } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Download, Upload, Target, Hammer } from 'lucide-react';
import { NumberFormatSection } from '@/components/charts/types/shared/NumberFormatSection';
import { DebouncedInput } from '@/components/charts/debounced-input';
import type { KPIFormData } from './kpi-form-types';
import { METRIC_TYPE_TAG_OPTIONS } from '@/types/kpis';
import type { NumberFormat } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface ProgramTagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  existingTags: string[];
}

function ProgramTagsInput({ value, onChange, existingTags }: ProgramTagsInputProps) {
  const [tagInput, setTagInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addTag = (raw: string, keepOpen = false) => {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setTagInput('');
    if (!keepOpen) setShowSuggestions(false);
  };

  const suggestions = existingTags.filter(
    (t) => !value.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase())
  );

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs gap-1">
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          value={tagInput}
          onChange={(e) => {
            setTagInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              if (tagInput.trim()) addTag(tagInput);
            }
          }}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200);
            if (tagInput.trim()) addTag(tagInput);
          }}
          placeholder="Type to search or create a tag"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-md max-h-32 overflow-y-auto">
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(tag, true);
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface KpiThresholdsStepProps {
  control: Control<KPIFormData>;
  register: UseFormRegister<KPIFormData>;
  watch: UseFormWatch<KPIFormData>;
  errors: FieldErrors<KPIFormData>;
  existingTags: string[];
}

const typeIcons: Record<string, React.ReactNode> = {
  input: <Download className="h-4 w-4" />,
  output: <Upload className="h-4 w-4" />,
  outcome: <Target className="h-4 w-4" />,
  impact: <Hammer className="h-4 w-4" />,
};

export function KpiThresholdsStep({
  control,
  register,
  watch,
  errors,
  existingTags,
}: KpiThresholdsStepProps) {
  const direction = watch('direction');
  const targetValue = watch('target_value');
  const greenThreshold = watch('green_threshold_pct');
  const amberThreshold = watch('amber_threshold_pct');

  const toFinite = (v: string): number | null => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const targetNum = toFinite(targetValue);
  const greenNum = toFinite(greenThreshold);
  const amberNum = toFinite(amberThreshold);
  const greenVal = targetNum !== null && greenNum !== null ? (targetNum * greenNum) / 100 : null;
  const amberVal = targetNum !== null && amberNum !== null ? (targetNum * amberNum) / 100 : null;

  const thresholdRules = {};

  return (
    <div className="space-y-4">
      {/* RAG Thresholds */}
      {targetValue && (
        <>
          <p className="text-sm text-muted-foreground font-medium mb-1">Target &amp; RAG Status</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <Label className="text-sm">On Track</Label>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">
                  {direction === 'increase' ? '≥' : '≤'}
                </span>
                <Input
                  type="number"
                  {...register('green_threshold_pct', thresholdRules)}
                  className="w-16 h-8"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              {errors.green_threshold_pct && (
                <p className="text-xs text-destructive">{errors.green_threshold_pct.message}</p>
              )}
              {greenVal !== null && (
                <p className="text-xs text-muted-foreground">
                  {direction === 'increase' ? '≥' : '≤'} {greenVal.toLocaleString()}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <Label className="text-sm">Needs Attention</Label>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  {...register('amber_threshold_pct', thresholdRules)}
                  className="w-16 h-8"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              {errors.amber_threshold_pct && (
                <p className="text-xs text-destructive">{errors.amber_threshold_pct.message}</p>
              )}
              {amberVal !== null && (
                <p className="text-xs text-muted-foreground">{amberVal.toLocaleString()}</p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <Label className="text-sm">Off Track</Label>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">
                  {direction === 'increase' ? '<' : '>'}
                </span>
                <Input
                  type="number"
                  value={amberThreshold}
                  disabled
                  className="w-16 h-8 bg-gray-50"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Classification */}
      <p className="text-sm text-muted-foreground font-medium mt-2 mb-1">Classification</p>
      <div className="space-y-1">
        <Label>Program Tags</Label>
        <Controller
          control={control}
          name="program_tags"
          render={({ field }) => (
            <ProgramTagsInput
              value={field.value}
              onChange={field.onChange}
              existingTags={existingTags}
            />
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>KPI Type</Label>
        <Controller
          control={control}
          name="metric_type_tag"
          render={({ field }) => (
            <div className="grid grid-cols-4 gap-2">
              {METRIC_TYPE_TAG_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => field.onChange(field.value === opt.value ? '' : opt.value)}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium uppercase transition-colors',
                    field.value === opt.value
                      ? 'text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                  style={
                    field.value === opt.value
                      ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' }
                      : undefined
                  }
                >
                  {typeIcons[opt.value]}
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Display Formatting */}
      <p className="text-sm text-muted-foreground font-medium mt-2 mb-1">Display Formatting</p>
      <div className="space-y-2">
        <Controller
          control={control}
          name="numberFormat"
          render={({ field: formatField }) => (
            <Controller
              control={control}
              name="decimalPlaces"
              render={({ field: decField }) => (
                <NumberFormatSection
                  idPrefix="kpi"
                  numberFormat={(formatField.value || undefined) as NumberFormat | undefined}
                  decimalPlaces={decField.value === '' ? undefined : Number(decField.value)}
                  onNumberFormatChange={(v) => formatField.onChange(v)}
                  onDecimalPlacesChange={(v) => decField.onChange(String(v))}
                />
              )}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="kpi-numberPrefix">Prefix</Label>
            <Controller
              control={control}
              name="numberPrefix"
              render={({ field }) => (
                <DebouncedInput
                  id="kpi-numberPrefix"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="e.g., ₹, $, +"
                />
              )}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kpi-numberSuffix">Suffix</Label>
            <Controller
              control={control}
              name="numberSuffix"
              render={({ field }) => (
                <DebouncedInput
                  id="kpi-numberSuffix"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="e.g., %, people, kg"
                />
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
