'use client';

import { Controller, type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { KPIFormData } from './kpi-form-types';
import { DIRECTION_OPTIONS, TIME_GRAIN_OPTIONS } from '@/types/kpis';
import type { TableColumn } from '@/types/explore';
import { DashboardNameHint } from '@/components/onboarding/dashboard-name-hint';

interface KpiSetupStepProps {
  control: Control<KPIFormData>;
  register: UseFormRegister<KPIFormData>;
  errors: FieldErrors<KPIFormData>;
  isEdit: boolean;
  dateColumns: TableColumn[];
  selectedMetric: { schema_name: string; table_name: string } | undefined;
  onDirectionChange: (direction: string) => void;
}

export function KpiSetupStep({
  control,
  register,
  errors,
  isEdit,
  dateColumns,
  selectedMetric,
  onDirectionChange,
}: KpiSetupStepProps) {
  return (
    <div className="space-y-4">
      {isEdit && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Metric, time column, and time grain cannot be changed after creation.
        </div>
      )}

      {/* KPI name */}
      <div className="space-y-1">
        <Label htmlFor="kpi-name" className="flex items-center gap-2">
          <span>
            Name this KPI <span className="text-destructive">*</span>
          </span>
          {!isEdit && <DashboardNameHint id="kpi-name-guidance" />}
        </Label>
        <Input
          id="kpi-name"
          aria-describedby={!isEdit ? 'kpi-name-guidance' : undefined}
          {...register('name', { required: 'KPI name is required' })}
          placeholder="Choose a unique KPI name"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      {/* Target value */}
      <div className="space-y-1" data-testid="kpi-form-target-field">
        <Label>
          Target Value <span className="text-destructive">*</span>
        </Label>
        <Input
          type="number"
          {...register('target_value', { required: 'Target value is required' })}
          placeholder="What is the desired value of this indicator"
        />
        {errors.target_value && (
          <p className="text-xs text-destructive">{errors.target_value.message}</p>
        )}
      </div>

      {/* Direction */}
      <div className="space-y-1" data-testid="kpi-form-direction-field">
        <Label>
          Direction <span className="text-destructive">*</span>
        </Label>
        <Controller
          control={control}
          name="direction"
          rules={{ required: 'Direction is required' }}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v);
                onDirectionChange(v);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIRECTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">
          Should this indicator increase or decrease to meet the target
        </p>
      </div>

      {/* Time configuration */}
      <p className="text-sm text-muted-foreground font-medium mt-2 mb-1">Time Configuration</p>

      {dateColumns.length === 0 && selectedMetric ? (
        <p className="text-sm text-muted-foreground">
          No date/timestamp columns found in {selectedMetric.schema_name}.
          {selectedMetric.table_name}. Trend charts require a time column.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1" data-testid="kpi-form-time-column-field">
            <Label className="text-sm">
              Time Column <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="time_dimension_column"
              rules={{ required: 'Time column is required' }}
              render={({ field }) => (
                <Select
                  disabled={isEdit}
                  value={field.value || '__none__'}
                  onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {dateColumns.map((col) => (
                      <SelectItem key={col.name} value={col.name || ''}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.time_dimension_column && (
              <p className="text-xs text-destructive">{errors.time_dimension_column.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-sm">
              Time Grain <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="time_grain"
              rules={{ required: 'Time grain is required' }}
              render={({ field }) => (
                <Select disabled={isEdit} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_GRAIN_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
