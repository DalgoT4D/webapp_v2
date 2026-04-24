'use client';

import { useCallback, useMemo } from 'react';
import {
  Controller,
  useWatch,
  type Control,
  type FieldValues,
  type UseFormSetValue,
} from 'react-hook-form';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { FieldNode } from '../types';
import { FieldLabel } from './FieldLabel';
import { renderField } from '../ConnectorConfigForm';

interface OneOfFieldProps {
  field: FieldNode;
  control: Control<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  disabled?: boolean;
}

export function OneOfField({ field, control, setValue, disabled }: OneOfFieldProps) {
  const fieldPath = field.path.join('.');
  const discriminatorPath = field.constKey ? [...field.path, field.constKey].join('.') : '';

  // Watch the discriminator value to show/hide sub-fields
  const selectedValue = useWatch({ control, name: discriminatorPath });

  // Clear sub-field values when discriminator changes
  const handleDiscriminatorChange = useCallback(
    (newValue: string) => {
      // Clear previously visible sub-fields
      if (field.oneOfSubFields) {
        for (const subField of field.oneOfSubFields) {
          if (subField.parentValue === selectedValue) {
            setValue(subField.path.join('.'), undefined);
          }
        }
      }
      setValue(discriminatorPath, newValue);
    },
    [field.oneOfSubFields, selectedValue, discriminatorPath, setValue]
  );

  // Filter sub-fields for the currently selected option
  const visibleSubFields = field.oneOfSubFields?.filter((f) => f.parentValue === selectedValue);

  // Determine default from constOptions
  const defaultValue =
    typeof field.default === 'string' ? field.default : (field.constOptions?.[0]?.value ?? '');

  const comboboxItems = useMemo<ComboboxItem[]>(
    () =>
      (field.constOptions ?? []).map((option) => ({
        value: option.value,
        label: option.title,
      })),
    [field.constOptions]
  );

  return (
    <div data-testid={`field-${fieldPath}`}>
      <FieldLabel
        title={field.title}
        required={field.required}
        description={field.description}
        htmlFor={discriminatorPath}
      />

      {/* Discriminator selector */}
      {field.displayType === 'radio' ? (
        <Controller
          name={discriminatorPath}
          control={control}
          defaultValue={defaultValue}
          rules={field.required ? { required: `${field.title} is required` } : undefined}
          render={({ field: formField, fieldState }) => (
            <>
              <RadioGroup
                value={formField.value}
                onValueChange={(val) => {
                  handleDiscriminatorChange(val);
                }}
                disabled={disabled}
                className="flex flex-col gap-2"
                data-testid={`radio-${fieldPath}`}
              >
                {field.constOptions?.map((option) => (
                  <div key={option.value} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={option.value}
                      id={`${fieldPath}-${option.value}`}
                      data-testid={`radio-item-${fieldPath}-${option.value}`}
                    />
                    <Label
                      htmlFor={`${fieldPath}-${option.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.title}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {fieldState.error && (
                <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>
              )}
            </>
          )}
        />
      ) : (
        <Controller
          name={discriminatorPath}
          control={control}
          defaultValue={defaultValue}
          rules={field.required ? { required: `${field.title} is required` } : undefined}
          render={({ field: formField, fieldState }) => (
            <>
              <Combobox
                id={`select-${fieldPath}`}
                items={comboboxItems}
                value={formField.value}
                onValueChange={(val) => {
                  handleDiscriminatorChange(val);
                }}
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
      )}

      {/* Sub-fields for selected option */}
      {visibleSubFields && visibleSubFields.length > 0 && (
        <div className="mt-3 ml-3 pl-3 border-l-2 border-muted space-y-4">
          {visibleSubFields.map((subField) => renderField(subField, control, setValue, disabled))}
        </div>
      )}
    </div>
  );
}
