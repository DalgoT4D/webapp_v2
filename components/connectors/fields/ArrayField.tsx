'use client';

import { useState, useCallback } from 'react';
import {
  Controller,
  useFieldArray,
  type Control,
  type FieldValues,
  type UseFormSetValue,
} from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { FieldNode } from '../types';
import { FieldLabel } from './FieldLabel';
import { renderField } from '../ConnectorConfigForm';

interface ArrayFieldProps {
  field: FieldNode;
  control: Control<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  disabled?: boolean;
}

export function ArrayField({ field, control, setValue, disabled }: ArrayFieldProps) {
  if (field.arrayItemType === 'object') {
    return (
      <ObjectArrayField field={field} control={control} setValue={setValue} disabled={disabled} />
    );
  }

  return <SimpleArrayField field={field} control={control} disabled={disabled} />;
}

// ============ Simple array (tag-style input) ============

function SimpleArrayField({
  field,
  control,
  disabled,
}: {
  field: FieldNode;
  control: Control<FieldValues>;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState('');
  const fieldPath = field.path.join('.');

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
        defaultValue={field.default ?? []}
        rules={
          field.required
            ? {
                validate: (v) => (Array.isArray(v) && v.length > 0) || `${field.title} is required`,
              }
            : undefined
        }
        render={({ field: formField, fieldState }) => {
          const values: string[] = Array.isArray(formField.value) ? formField.value : [];

          const addValue = () => {
            const trimmed = inputValue.trim();
            if (trimmed && !values.includes(trimmed)) {
              formField.onChange([...values, trimmed]);
              setInputValue('');
            }
          };

          const removeValue = (index: number) => {
            formField.onChange(values.filter((_, i) => i !== index));
          };

          return (
            <div>
              <div className="flex flex-wrap items-center gap-1 min-h-[40px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                {values.map((val, idx) => (
                  <span
                    key={`${val}-${idx}`}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-sm text-secondary-foreground"
                  >
                    <span className="max-w-[120px] truncate">{val}</span>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => removeValue(idx)}
                        className="inline-flex items-center justify-center rounded-full hover:bg-secondary-foreground/20 p-0.5"
                        data-testid={`remove-tag-${fieldPath}-${idx}`}
                        aria-label={`Remove ${val}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
                <input
                  id={fieldPath}
                  data-testid={`input-${fieldPath}`}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addValue();
                    }
                    if (e.key === 'Backspace' && !inputValue && values.length > 0) {
                      removeValue(values.length - 1);
                    }
                  }}
                  placeholder={values.length === 0 ? 'Type and press Enter' : ''}
                  disabled={disabled}
                  className="flex-1 min-w-[80px] border-0 bg-transparent p-0 h-6 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              {fieldState.error && (
                <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}

// ============ Object array (numbered containers with sub-fields) ============

/**
 * Recursively rewrite all paths in a FieldNode tree so they include the
 * array index. E.g. ['streams', 'format'] → ['streams', '0', 'format'].
 */
function reindexFieldNode(
  node: FieldNode,
  arrayPath: string[],
  indexedPrefix: string[]
): FieldNode {
  const reindexed: FieldNode = {
    ...node,
    path: [...indexedPrefix, ...node.path.slice(arrayPath.length)],
  };

  if (node.oneOfSubFields) {
    reindexed.oneOfSubFields = node.oneOfSubFields.map((sf) =>
      reindexFieldNode(sf, arrayPath, indexedPrefix)
    );
  }
  if (node.arraySubFields) {
    reindexed.arraySubFields = node.arraySubFields.map((sf) =>
      reindexFieldNode(sf, arrayPath, indexedPrefix)
    );
  }

  return reindexed;
}

function ObjectArrayField({
  field,
  control,
  setValue,
  disabled,
}: {
  field: FieldNode;
  control: Control<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  disabled?: boolean;
}) {
  const fieldPath = field.path.join('.');
  const {
    fields: items,
    append,
    remove,
  } = useFieldArray({
    control,
    name: fieldPath,
  });

  const handleAdd = useCallback(() => {
    append({});
  }, [append]);

  return (
    <div data-testid={`field-${fieldPath}`}>
      <FieldLabel
        title={field.title}
        required={field.required}
        description={field.description}
        htmlFor={fieldPath}
      />

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="relative rounded-md border p-4"
            data-testid={`array-item-${fieldPath}-${index}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  data-testid={`remove-item-${fieldPath}-${index}`}
                  aria-label={`Remove item ${index + 1}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {field.arraySubFields?.map((subField) => {
                const indexedPrefix = [fieldPath, String(index)];
                const indexedField = reindexFieldNode(subField, field.path, indexedPrefix);
                return renderField(indexedField, control, setValue, disabled);
              })}
            </div>
          </div>
        ))}
      </div>

      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="mt-2"
          data-testid={`add-item-${fieldPath}`}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Item
        </Button>
      )}
    </div>
  );
}
