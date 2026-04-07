// components/transform/CreateTaskDialog.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Trash2 } from 'lucide-react';
import { useTaskTemplates, useTaskConfig, createCustomTask } from '@/hooks/api/useTaskTemplates';
import { toastSuccess, toastError } from '@/lib/toast';
import { Combobox } from '@/components/ui/combobox';
import { TASK_GITPULL, TASK_DBTCLEAN, TASK_DBTCLOUD_JOB } from '@/constants/dbt-tasks';

interface TaskFormData {
  task_slug: string;
  flags: string[];
  options: Array<{ key: string; value: string }>;
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateTaskDialog({ open, onOpenChange, onSuccess }: CreateTaskDialogProps) {
  const { data: templates, isLoading: templatesLoading } = useTaskTemplates();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const { data: config, isLoading: configLoading } = useTaskConfig(selectedSlug);
  const [loading, setLoading] = useState(false);
  const optionsRef = useRef<Array<{ key: string; value: string }>>([]);

  const form = useForm<TaskFormData>({
    defaultValues: {
      task_slug: '',
      flags: [],
      options: [{ key: '', value: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'options',
  });

  const watchedSlug = form.watch('task_slug');
  const watchedFlags = form.watch('flags');
  optionsRef.current = form.watch('options');

  // Filter out git-pull and dbt-clean tasks
  const filteredTemplates = templates?.filter(
    (task) => ![TASK_GITPULL, TASK_DBTCLEAN].includes(task.slug)
  );

  // Load selected slug config
  useEffect(() => {
    if (watchedSlug && watchedSlug !== selectedSlug) {
      setSelectedSlug(watchedSlug);
      // Reset flags and options when task changes
      form.setValue('flags', []);
      form.setValue('options', [{ key: '', value: '' }]);
    }
  }, [watchedSlug, selectedSlug]);

  // Generate command preview (matching legacy format)
  const getCommandPreview = () => {
    if (!watchedSlug) return '';

    // Replace dashes with spaces in task slug
    let command = watchedSlug.replace(/-/g, ' ');

    // Add flags with -- prefix
    if (watchedFlags.length > 0) {
      command += ' ' + watchedFlags.map((flag) => `--${flag}`).join(' ');
    }

    // Add options with -- prefix
    const validOptions = optionsRef.current?.filter((opt) => opt.key && opt.value);
    if (validOptions && validOptions.length > 0) {
      command += ' ' + validOptions.map((opt) => `--${opt.key} ${opt.value}`).join(' ');
    }

    return command;
  };

  const handleFormClose = () => {
    form.reset({
      task_slug: '',
      flags: [],
      options: [{ key: '', value: '' }],
    });
    setSelectedSlug(null);
    onOpenChange(false);
  };

  const onSubmit = async (data: TaskFormData) => {
    if (!data.task_slug) {
      toastError.api('Please select a task');
      return;
    }

    setLoading(true);
    try {
      // Transform options array to object
      const paramOptions: Record<string, string> = {};
      data.options
        .filter((opt) => opt.key && opt.value)
        .forEach((opt) => {
          paramOptions[opt.key] = opt.value;
        });

      await createCustomTask({
        task_slug: data.task_slug,
        flags: data.flags,
        options: paramOptions,
      });

      toastSuccess.created('Org Task');
      handleFormClose();
      onSuccess();
    } catch (error: unknown) {
      toastError.create(error, 'task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleFormClose}>
      <DialogContent className="sm:max-w-[700px] p-0">
        {/* Header - Fixed */}
        <div className="px-6 py-5 border-b">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-gray-900">
              Add a new org task
            </DialogTitle>
          </DialogHeader>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
          {/* Scrollable content */}
          <div className="px-6 py-6 space-y-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
            {/* Task Selector */}
            <div className="space-y-2">
              <Label htmlFor="task_slug" className="text-[15px] font-medium">
                Select task <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="task_slug"
                control={form.control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={templatesLoading}
                  >
                    <SelectTrigger id="task_slug" data-testid="selecttask">
                      <SelectValue placeholder="Select task" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTemplates?.map((template) => (
                        <SelectItem key={template.slug} value={template.slug}>
                          {template.slug}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Flags - Multi-select Combobox */}
            <div className="space-y-2">
              <Label htmlFor="flags" className="text-[15px] font-medium">
                Flags
              </Label>
              <Controller
                name="flags"
                control={form.control}
                render={({ field }) => (
                  <Combobox
                    mode="multi"
                    items={
                      config?.flags?.map((flag) => ({
                        value: flag,
                        label: flag,
                      })) || []
                    }
                    values={field.value}
                    onValuesChange={field.onChange}
                    placeholder="Select flags"
                    searchPlaceholder="Search flags..."
                    emptyMessage="No flags found"
                    disabled={!config || config.flags.length === 0}
                    id="flags"
                  />
                )}
              />
            </div>

            {/* Options - Dynamic FieldArray */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Options</Label>
              <div className="space-y-2">
                {fields.map((item, index) => (
                  <div key={item.id} className="flex gap-2" data-testid="optionsListItems">
                    <Controller
                      name={`options.${index}.key`}
                      control={form.control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={
                            fields.length - 1 !== index || !config || config.options.length === 0
                          }
                        >
                          <SelectTrigger className="w-[45%]" data-testid={`option-key-${index}`}>
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            {config?.options?.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <Input
                      {...form.register(`options.${index}.value`)}
                      placeholder="Value"
                      disabled={fields.length - 1 !== index}
                      className="w-[45%]"
                      data-testid={`option-value-${index}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Remove option"
                      onClick={() => {
                        remove(index);
                        optionsRef.current = form.getValues('options');
                      }}
                      data-testid={`remove-option-button-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    optionsRef.current = form.getValues('options');
                    append({ key: '', value: '' });
                  }}
                  data-testid="add-option-button"
                  className="w-full"
                >
                  ADD OPTION
                </Button>
              </div>
            </div>

            {/* Command Preview (hidden for dbt-cloud-job tasks) */}
            {watchedSlug && watchedSlug !== TASK_DBTCLOUD_JOB && getCommandPreview() && (
              <div className="space-y-1">
                <Label className="text-[15px] font-medium">Command:</Label>
                <div className="text-sm text-muted-foreground font-mono bg-gray-50 p-3 rounded">
                  {getCommandPreview()}
                </div>
              </div>
            )}
          </div>

          {/* Actions - Fixed footer */}
          <div className="px-6 py-4 border-t bg-gray-50">
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleFormClose}
                disabled={loading}
                data-testid="cancel-btn"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                data-testid="save-task-btn"
                variant="ghost"
                className="text-white hover:text-white hover:opacity-90 shadow-xs"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
