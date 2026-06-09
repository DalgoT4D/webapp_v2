'use client';

import { useMemo } from 'react';
import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import type { FieldNode } from '../types';
import { FieldLabel } from './FieldLabel';

interface EnumFieldProps {
  field: FieldNode;
  control: Control<FieldValues>;
  disabled?: boolean;
}

export function EnumField({ field, control, disabled }: EnumFieldProps) {
  const fieldPath = field.path.join('.');

  const items = useMemo<ComboboxItem[]>(
    () =>
      (field.enumValues ?? []).map((value) => ({
        value,
        label: value,
      })),
    [field.enumValues]
  );

  return (
    <div data-testid={`field-${fieldPath}`}>
      <FieldLabel
        title={field.title}
        required={field.required}
        description={field.description}
        htmlFor={fieldPath}
      />
      <Controller
        name={fieldPath}
        control={control}
        defaultValue={field.default ?? ''}
        rules={field.required ? { required: `${field.title} is required` } : undefined}
        render={({ field: formField, fieldState }) => (
          <>
            <Combobox
              id={`select-${fieldPath}`}
              items={items}
              value={formField.value}
              onValueChange={formField.onChange}
              placeholder={`Select ${field.title}`}
              searchPlaceholder={`Search ${field.title.toLowerCase()}...`}
              emptyMessage={`No ${field.title.toLowerCase()} found.`}
              disabled={disabled}
            />
            {fieldState.error && (
              <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>
            )}
          </>
        )}
      />
    </div>
  );
}
