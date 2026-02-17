'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Combobox, ComboboxItem } from '@/components/ui/combobox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  usePipeline,
  useTransformTasks,
  useConnections,
  createPipeline,
  updatePipeline,
  setScheduleStatus,
} from '@/hooks/api/usePipelines';
import {
  TransformTask,
  PipelineFormData,
  ConnectionOption,
  WeekdayOption,
  PipelineDetailResponse,
  Connection,
} from '@/types/pipeline';
import { TaskSequence } from './task-sequence';
import {
  convertToCronExpression,
  convertCronToSchedule,
  localTimezone,
  validateDefaultTasksToApplyInPipeline,
  localTimeToUTC,
  utcTimeToLocal,
} from '@/lib/pipeline-utils';
import { WEEKDAYS, SCHEDULE_OPTIONS } from '@/constants/pipeline';

interface PipelineFormProps {
  deploymentId?: string;
}

// Wrapper component that handles data fetching
export function PipelineForm({ deploymentId }: PipelineFormProps) {
  const { pipeline, isLoading: pipelineLoading } = usePipeline(deploymentId || null);
  const { tasks, isLoading: tasksLoading } = useTransformTasks();
  const { connections, isLoading: connectionsLoading } = useConnections();

  const isLoading = pipelineLoading || tasksLoading || connectionsLoading;

  if (isLoading) {
    return <FormSkeleton />;
  }

  // Only render the form content once all data is loaded
  // This ensures defaultValues are set correctly from the start
  return (
    <PipelineFormContent
      deploymentId={deploymentId}
      pipeline={pipeline}
      tasks={tasks}
      connections={connections}
    />
  );
}

interface PipelineFormContentProps {
  deploymentId?: string;
  pipeline: PipelineDetailResponse | undefined;
  tasks: TransformTask[];
  connections: Connection[];
}

// Compute initial form values from pipeline data
function computeInitialValues(
  pipeline: PipelineDetailResponse | undefined,
  tasks: TransformTask[]
): { formValues: PipelineFormData; initialAlignment: 'simple' | 'advanced' } {
  if (!pipeline) {
    // Create mode - use defaults
    return {
      formValues: {
        active: true,
        name: '',
        connections: [],
        cron: null,
        tasks: [],
        cronDaysOfWeek: [],
        cronTimeOfDay: '',
      },
      initialAlignment: 'simple',
    };
  }

  // Edit mode - compute values from pipeline
  let tasksToApply: TransformTask[] = [];
  let alignment: 'simple' | 'advanced' = 'simple';

  if (tasks.length > 0) {
    if (pipeline.transformTasks.length === 0) {
      tasksToApply = [];
    } else {
      tasksToApply = tasks.filter(validateDefaultTasksToApplyInPipeline);

      const ifTasksAligned =
        tasksToApply.length > 0 &&
        tasksToApply.length === pipeline.transformTasks.length &&
        pipeline.transformTasks.every(
          (task, index) => tasksToApply[index] && task.uuid === tasksToApply[index].uuid
        );

      if (!ifTasksAligned) {
        const uuidOrder = pipeline.transformTasks.reduce((acc: Record<string, number>, obj) => {
          acc[obj.uuid] = obj.seq;
          return acc;
        }, {});

        tasksToApply = tasks
          .filter((t) => uuidOrder.hasOwnProperty(t.uuid))
          .sort((a, b) => uuidOrder[a.uuid] - uuidOrder[b.uuid]);

        alignment = 'advanced';
      }
    }
  }

  const cronObject = convertCronToSchedule(pipeline.cron);

  return {
    formValues: {
      cron:
        cronObject.schedule !== 'manual'
          ? { id: cronObject.schedule, label: cronObject.schedule }
          : { id: 'manual', label: 'Manual' },
      connections: pipeline.connections
        .sort((c1, c2) => c1.seq - c2.seq)
        .map((conn) => ({
          id: conn.id,
          label: conn.name,
        })),
      active: pipeline.isScheduleActive,
      name: pipeline.name,
      tasks: tasksToApply,
      cronDaysOfWeek: cronObject.daysOfWeek.map((day) => ({
        id: day,
        label: WEEKDAYS[day],
      })),
      cronTimeOfDay: utcTimeToLocal(cronObject.timeOfDay),
    },
    initialAlignment: alignment,
  };
}

function PipelineFormContent({
  deploymentId,
  pipeline,
  tasks,
  connections,
}: PipelineFormContentProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditMode = !!deploymentId;

  // Compute initial values once when component mounts
  const { formValues: initialValues, initialAlignment } = useMemo(
    () => computeInitialValues(pipeline, tasks),
    // Only compute once on mount - pipeline and tasks won't change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [alignment, setAlignment] = useState<'simple' | 'advanced'>(initialAlignment);
  const [submitting, setSubmitting] = useState(false);

  // Store the original active value to compare against for dirty checking
  const originalActiveValue = useMemo(() => pipeline?.isScheduleActive ?? true, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PipelineFormData>({
    defaultValues: initialValues,
  });

  const scheduleSelected = watch('cron');
  const currentActiveValue = watch('active');

  // Connection options for combobox
  const connectionItems: ComboboxItem[] = useMemo(() => {
    return connections.map((conn) => ({
      value: conn.connectionId,
      label: conn.name,
    }));
  }, [connections]);

  // Weekday options
  const weekdayItems: ComboboxItem[] = useMemo(() => {
    return Object.entries(WEEKDAYS).map(([id, label]) => ({
      value: id,
      label,
    }));
  }, []);

  // Schedule options
  const scheduleItems: ComboboxItem[] = useMemo(() => {
    return SCHEDULE_OPTIONS.map((opt) => ({
      value: opt.id,
      label: opt.label.charAt(0).toUpperCase() + opt.label.slice(1),
    }));
  }, []);

  const handleAlignmentChange = (newAlignment: string) => {
    if (!newAlignment) return;
    if (newAlignment === 'simple') {
      setValue('tasks', []);
    }
    setAlignment(newAlignment as 'simple' | 'advanced');
  };

  const handleCancel = () => {
    router.push('/orchestrate');
  };

  const onSubmit = async (data: PipelineFormData) => {
    setSubmitting(true);

    try {
      const cronExpression = convertToCronExpression(
        data.cron?.id || 'manual',
        data.cronDaysOfWeek.map((opt) => opt.id),
        data.cronTimeOfDay ? localTimeToUTC(data.cronTimeOfDay) : '1 0'
      );

      const selectedConns = data.connections.map((conn, index) => ({
        id: conn.id,
        seq: index + 1,
      }));

      const transformTasks = data.tasks.map((task, index) => ({
        uuid: task.uuid,
        seq: index + 1,
      }));

      if (isEditMode && deploymentId) {
        await updatePipeline(deploymentId, {
          name: data.name,
          connections: selectedConns,
          cron: cronExpression,
          transformTasks,
        });

        // Update schedule status if changed - compare against original value
        const activeChanged = data.active !== originalActiveValue;
        let scheduleStatusFailed = false;
        if (activeChanged) {
          try {
            await setScheduleStatus(deploymentId, data.active);
          } catch (statusError: any) {
            scheduleStatusFailed = true;
            toast({
              title: 'Warning',
              description:
                statusError.message ||
                'Pipeline updated, but failed to update schedule status. Please try toggling the status again.',
              variant: 'destructive',
            });
          }
        }

        if (!scheduleStatusFailed) {
          toast({
            title: 'Pipeline updated',
            description: `Pipeline ${data.name} updated successfully`,
          });
        }
      } else {
        const response = await createPipeline({
          name: data.name,
          connections: selectedConns,
          cron: cronExpression,
          transformTasks,
        });

        toast({
          title: 'Pipeline created',
          description: `Pipeline ${response.name} created successfully`,
        });
      }

      router.push('/orchestrate');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save pipeline',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">
          {isEditMode ? 'Update Pipeline' : 'Create Pipeline'}
        </h1>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditMode ? 'Save Changes' : 'Create Pipeline'}
          </Button>
        </div>
      </div>

      {/* Form content - Two column layout */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x">
          {/* Left column - Pipeline details */}
          <div className="lg:col-span-3 p-6 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Pipeline Details</h2>

            {/* Active toggle (edit mode only) */}
            {isEditMode && (
              <div className="flex items-center gap-3">
                <Controller
                  name="active"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="activeSwitch"
                    />
                  )}
                />
                <Label className="text-[15px]">Is Active?</Label>
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[15px] font-medium">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter the name of your pipeline"
                {...register('name', { required: 'Name is required' })}
                data-testid="name"
                className="h-10 text-[15px]"
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            {/* Connections */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Connections</Label>
              <Controller
                name="connections"
                control={control}
                render={({ field }) => (
                  <Combobox
                    mode="multi"
                    items={connectionItems}
                    values={field.value.map((c) => c.id)}
                    onValuesChange={(values) => {
                      const newConnections = values
                        .map((v) => {
                          const conn = connections.find((c) => c.connectionId === v);
                          return conn ? { id: conn.connectionId, label: conn.name } : null;
                        })
                        .filter(Boolean) as ConnectionOption[];
                      field.onChange(newConnections);
                    }}
                    placeholder="Select your connections"
                    searchPlaceholder="Search connections..."
                    id="connections"
                  />
                )}
              />
            </div>

            {/* Transform tasks */}
            <div className="space-y-3">
              <Label className="text-[15px] font-medium">Transform Tasks</Label>
              <div className="flex items-center gap-3">
                <ToggleGroup type="single" value={alignment} onValueChange={handleAlignmentChange}>
                  <ToggleGroupItem value="simple" className="text-[14px]">
                    Simple
                  </ToggleGroupItem>
                  <ToggleGroupItem value="advanced" className="text-[14px]">
                    Advanced
                  </ToggleGroupItem>
                </ToggleGroup>
                <span className="text-sm text-gray-500">
                  You can create custom tasks from the transformation page
                </span>
              </div>

              <Controller
                name="tasks"
                control={control}
                render={({ field }) =>
                  alignment === 'simple' ? (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="run-all-tasks"
                        checked={field.value.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            field.onChange(tasks.filter(validateDefaultTasksToApplyInPipeline));
                          } else {
                            field.onChange([]);
                          }
                        }}
                      />
                      <Label htmlFor="run-all-tasks" className="text-[15px]">
                        Run all tasks
                      </Label>
                    </div>
                  ) : (
                    <TaskSequence value={field.value} onChange={field.onChange} options={tasks} />
                  )
                }
              />
            </div>
          </div>

          {/* Right column - Schedule */}
          <div className="lg:col-span-2 p-6 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Schedule</h2>

            {/* Schedule type */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">
                Frequency <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="cron"
                control={control}
                rules={{ required: 'Schedule is required' }}
                render={({ field }) => (
                  <Combobox
                    items={scheduleItems}
                    value={field.value?.id || ''}
                    onValueChange={(value) => {
                      const option = scheduleItems.find((s) => s.value === value);
                      field.onChange(option ? { id: option.value, label: option.label } : null);
                    }}
                    placeholder="Select schedule"
                    id="cron"
                  />
                )}
              />
              {errors.cron && <p className="text-sm text-red-500">{errors.cron.message}</p>}
            </div>

            {/* Days of week (for weekly) */}
            {scheduleSelected?.id === 'weekly' && (
              <div className="space-y-2">
                <Label className="text-[15px] font-medium">
                  Days of the Week <span className="text-red-500">*</span>
                </Label>
                <Controller
                  name="cronDaysOfWeek"
                  control={control}
                  rules={{ required: 'Day(s) of week is required' }}
                  render={({ field }) => (
                    <Combobox
                      mode="multi"
                      items={weekdayItems}
                      values={field.value.map((d) => d.id)}
                      onValuesChange={(values) => {
                        const newDays = values
                          .map((v) => ({
                            id: v,
                            label: WEEKDAYS[v],
                          }))
                          .filter((d) => d.label) as WeekdayOption[];
                        field.onChange(newDays);
                      }}
                      placeholder="Select day(s)"
                      id="cronDaysOfWeek"
                    />
                  )}
                />
                {errors.cronDaysOfWeek && (
                  <p className="text-sm text-red-500">{errors.cronDaysOfWeek.message}</p>
                )}
              </div>
            )}

            {/* Time of day (for daily/weekly) */}
            {scheduleSelected && scheduleSelected.id !== 'manual' && (
              <div className="space-y-2">
                <Label className="text-[15px] font-medium">
                  Time of Day <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Controller
                    name="cronTimeOfDay"
                    control={control}
                    rules={{ required: 'Time of day is required' }}
                    render={({ field }) => (
                      <Input
                        type="time"
                        value={field.value}
                        onChange={field.onChange}
                        data-testid="cronTimeOfDay"
                        className="h-10 w-36 text-[15px]"
                      />
                    )}
                  />
                  <span className="text-sm text-gray-500">({localTimezone()})</span>
                </div>
                {errors.cronTimeOfDay && (
                  <p className="text-sm text-red-500">{errors.cronTimeOfDay.message}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x">
          <div className="lg:col-span-3 p-6 space-y-6">
            <Skeleton className="h-6 w-36" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-48" />
            </div>
          </div>
          <div className="lg:col-span-2 p-6 space-y-6">
            <Skeleton className="h-6 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
