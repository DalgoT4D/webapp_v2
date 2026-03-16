// components/transform/canvas/forms/CreateTableForm.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { Loader2 } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { useTransformStore } from '@/stores/transformStore';
import { apiGet, apiPost } from '@/lib/api';
import type { GenericNodeProps } from '@/types/transform';

interface CreateTableFormProps {
  /** Current selected node */
  node: GenericNodeProps | null | undefined;
  /** Callback to close panel and cleanup */
  clearAndClosePanel?: () => void;
  /** Loading state setter */
  setLoading: (loading: boolean) => void;
}

interface FormValues {
  output_name: string;
  dest_schema: string;
  rel_dir_to_models: string;
}

interface DirectoriesResponse {
  directories: string[];
}

// Default fallback directories
const DEFAULT_DIRECTORIES = ['', 'intermediate', 'production', 'staging'];

// Default fallback schemas
const DEFAULT_SCHEMAS = ['intermediate', 'production'];

/**
 * Form to terminate the operation chain and create a dbt model.
 * Allows specifying output name, destination schema, and directory.
 */
export function CreateTableForm({ node, clearAndClosePanel, setLoading }: CreateTableFormProps) {
  const { dispatchCanvasAction, triggerRefresh } = useTransformStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [directories, setDirectories] = useState<ComboboxItem[]>([]);
  const [schemas, setSchemas] = useState<ComboboxItem[]>([]);
  const [customSchema, setCustomSchema] = useState('');
  const [customDirectory, setCustomDirectory] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      output_name: '',
      dest_schema: '',
      rel_dir_to_models: '',
    },
  });

  const selectedSchema = watch('dest_schema');
  const selectedDirectory = watch('rel_dir_to_models');

  // Fetch model directories on mount
  useEffect(() => {
    const fetchDirectories = async () => {
      try {
        const response = (await apiGet(
          '/api/transform/v2/dbt_project/models_directories/'
        )) as DirectoriesResponse;
        const dirs = response.directories || DEFAULT_DIRECTORIES;
        setDirectories(
          dirs.map((dir: string) => ({
            value: dir,
            label: dir === '' ? '/' : `${dir}/`,
          }))
        );
      } catch (error) {
        console.error('Failed to fetch directories:', error);
        setDirectories(
          DEFAULT_DIRECTORIES.map((dir: string) => ({
            value: dir,
            label: dir === '' ? '/' : `${dir}/`,
          }))
        );
      }
    };

    // Fetch schemas (using directories as schemas for now, or could be a separate endpoint)
    const fetchSchemas = async () => {
      try {
        // For now, use default schemas. In production, this would be an API call.
        setSchemas(
          DEFAULT_SCHEMAS.map((schema) => ({
            value: schema,
            label: schema,
          }))
        );
      } catch (error) {
        console.error('Failed to fetch schemas:', error);
        setSchemas(
          DEFAULT_SCHEMAS.map((schema) => ({
            value: schema,
            label: schema,
          }))
        );
      }
    };

    fetchDirectories();
    fetchSchemas();
  }, []);

  // Pre-fill form if editing an existing model
  useEffect(() => {
    if (node?.data?.dbtmodel && node.data.is_last_in_chain) {
      const model = node.data.dbtmodel;
      setValue('output_name', model.name || '');
      setValue('dest_schema', model.schema || '');
    }
  }, [node, setValue]);

  const handleSchemaChange = useCallback(
    (value: string) => {
      setValue('dest_schema', value);
      setCustomSchema('');
    },
    [setValue]
  );

  const handleDirectoryChange = useCallback(
    (value: string) => {
      setValue('rel_dir_to_models', value);
      setCustomDirectory('');
    },
    [setValue]
  );

  const onSubmit = async (data: FormValues) => {
    if (!node) {
      toastError.api('No node selected');
      return;
    }

    // Only operation nodes can terminate chains and create tables
    const nodeType = node.type || node.data?.node_type;
    if (nodeType !== 'operation') {
      toastError.api('Only operation nodes can create tables');
      return;
    }

    // Use custom values if entered
    const finalSchema = customSchema || data.dest_schema;
    const finalDirectory = customDirectory || data.rel_dir_to_models;

    if (!data.output_name.trim()) {
      toastError.api('Output name is required');
      return;
    }

    if (!finalSchema.trim()) {
      toastError.api('Schema is required');
      return;
    }

    setIsSubmitting(true);
    setLoading(true);

    try {
      const payload = {
        name: data.output_name.trim(),
        display_name: data.output_name.trim(),
        dest_schema: finalSchema.trim(),
        rel_dir_to_models: finalDirectory.trim(),
      };

      await apiPost(
        `/api/transform/v2/dbt_project/operations/nodes/${node.id}/terminate/`,
        payload
      );

      toastSuccess.generic('Table created successfully');

      // Trigger workflow execution
      dispatchCanvasAction({ type: 'run-workflow', data: null });

      // Refresh canvas
      triggerRefresh();

      // Close panel
      clearAndClosePanel?.();
    } catch (error) {
      console.error('Failed to create table:', error);
      toastError.create(error, 'table');
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
      {/* Output Name */}
      <div className="space-y-2">
        <Label htmlFor="output_name">Output Name *</Label>
        <Input
          id="output_name"
          placeholder="e.g., customer_summary"
          {...register('output_name', { required: 'Output name is required' })}
          data-testid="output-name-input"
        />
        {errors.output_name && (
          <p className="text-sm text-destructive">{errors.output_name.message}</p>
        )}
      </div>

      {/* Destination Schema */}
      <div className="space-y-2">
        <Label htmlFor="dest_schema">Output Schema Name *</Label>
        <p className="text-xs text-muted-foreground">
          Choose from existing schemas or type a name to create new
        </p>
        <Combobox
          id="dest-schema"
          items={schemas}
          value={selectedSchema}
          onValueChange={handleSchemaChange}
          placeholder="Select or type schema..."
          searchPlaceholder="Search or type new schema..."
          emptyMessage="Type to create new schema"
        />
        {/* Allow custom input */}
        <Input
          placeholder="Or type a new schema name..."
          value={customSchema}
          onChange={(e) => {
            setCustomSchema(e.target.value);
            setValue('dest_schema', '');
          }}
          className="mt-2"
          data-testid="custom-schema-input"
        />
      </div>

      {/* Directory under models */}
      <div className="space-y-2">
        <Label htmlFor="rel_dir_to_models">Directory under models *</Label>
        <p className="text-xs text-muted-foreground">
          Choose from existing dirs or type a path to create new folders (e.g., staging/orders)
        </p>
        <Combobox
          id="rel-dir"
          items={directories}
          value={selectedDirectory}
          onValueChange={handleDirectoryChange}
          placeholder="Select or type directory..."
          searchPlaceholder="Search or type new directory..."
          emptyMessage="Type to create new directory"
        />
        {/* Allow custom input */}
        <Input
          placeholder="Or type a new directory path..."
          value={customDirectory}
          onChange={(e) => {
            setCustomDirectory(e.target.value);
            setValue('rel_dir_to_models', '');
          }}
          className="mt-2"
          data-testid="custom-directory-input"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={clearAndClosePanel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 text-white hover:opacity-90"
          style={{ backgroundColor: 'var(--primary)' }}
          disabled={isSubmitting}
          data-testid="save-table-btn"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save'
          )}
        </Button>
      </div>
    </form>
  );
}
