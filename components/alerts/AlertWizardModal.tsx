'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createAlert, updateAlert, useAlert } from '@/hooks/api/useAlerts';
import {
  localScheduleToUtcCron,
  utcCronToLocalSchedule,
  AlertType,
  type AlertCondition,
  type AlertCreatePayload,
  type AlertResponse,
  type AlertUpdatePayload,
  type RecipientIn,
  type ScheduleSpec,
  type StandaloneConfig,
} from '@/types/alerts';
import { AlertDefineStep, type AlertDefineState } from './AlertDefineStep';
import { AlertNotifyStep, type AlertNotifyState } from './AlertNotifyStep';
import { AlertTestStep } from './AlertTestStep';
import type { AlertTestPayload } from '@/types/alerts';

type Step = 1 | 2 | 3;

interface AlertWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (alert: AlertResponse) => void;
  /**
   * Edit mode: the id of an existing alert. When provided the wizard fetches
   * the alert and prefills all steps.
   */
  alertId?: number | null;
  /** Create-mode prefill — which alert type and source to lock in. */
  initial?: {
    alertType?: AlertType;
    metricId?: number | null;
    kpiId?: number | null;
  };
}

function defaultScheduleSpec(): ScheduleSpec {
  return { frequency: 'daily', hour: 9, minute: 0 };
}

function defaultStandaloneConfig(): StandaloneConfig {
  return {
    schema_name: '',
    table_name: '',
    column: '',
    aggregation: '',
    column_expression: null,
    filters: [],
  };
}

function emptyDefineState(initial?: AlertWizardModalProps['initial']): AlertDefineState {
  return {
    name: '',
    alertType: initial?.alertType ?? AlertType.STANDALONE,
    metricId: initial?.metricId ?? null,
    kpiId: initial?.kpiId ?? null,
    standaloneConfig: defaultStandaloneConfig(),
    conditionOperator: 'lt',
    conditionValue: '',
    conditionRagStates: [],
    schedule: defaultScheduleSpec(),
  };
}

function emptyNotifyState(): AlertNotifyState {
  return {
    channels: ['email'],
    slackWebhookUrl: '',
    slackWebhookUrlIsMasked: false,
    messageTemplate: '',
    recipients: [],
  };
}

function buildCondition(state: AlertDefineState): AlertCondition {
  if (state.alertType === AlertType.KPI_RAG) {
    return { rag_states: state.conditionRagStates };
  }
  return { operator: state.conditionOperator, value: Number(state.conditionValue) };
}

function validateStep1(state: AlertDefineState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!state.name.trim()) errors.name = 'Name is required.';
  if (state.alertType === AlertType.METRIC_THRESHOLD && !state.metricId)
    errors.source = 'A metric is required.';
  if (state.alertType === AlertType.KPI_RAG && !state.kpiId) errors.source = 'A KPI is required.';
  if (state.alertType === AlertType.STANDALONE) {
    if (!state.standaloneConfig.schema_name || !state.standaloneConfig.table_name)
      errors.standalone_table = 'Pick a schema and table.';
    if (!state.standaloneConfig.aggregation)
      errors.standalone_table = errors.standalone_table || 'Pick an aggregation.';
    if (
      state.standaloneConfig.aggregation &&
      state.standaloneConfig.aggregation !== 'count' &&
      !state.standaloneConfig.column
    )
      errors.standalone_table = errors.standalone_table || 'Pick a column.';
  }
  if (state.alertType === AlertType.KPI_RAG) {
    if (state.conditionRagStates.length < 1) errors.rag_states = 'Pick at least 1 RAG state.';
    if (state.conditionRagStates.length > 2) errors.rag_states = 'At most 2 RAG states allowed.';
  } else {
    if (state.conditionValue === '' || Number.isNaN(Number(state.conditionValue)))
      errors.condition_value = 'Threshold value is required.';
  }
  return errors;
}

function validateStep2(state: AlertNotifyState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (state.channels.length === 0) {
    errors.channels = 'Pick at least one delivery channel.';
  }
  if (state.channels.includes('slack')) {
    const url = state.slackWebhookUrl.trim();
    // For edit mode the masked URL is "ok" — backend keeps existing.
    if (!state.slackWebhookUrlIsMasked && !url)
      errors.slack_webhook_url = 'Slack webhook URL is required.';
    if (url && !state.slackWebhookUrlIsMasked && !url.startsWith('https://'))
      errors.slack_webhook_url = 'Webhook URL must start with https://';
  }
  // Recipients only matter when Email is enabled (Slack delivers via webhook only).
  if (state.channels.includes('email') && state.recipients.length === 0) {
    errors.recipients = 'Pick at least one recipient.';
  }
  if (!state.messageTemplate.trim()) errors.message_template = 'Message template cannot be empty.';
  return errors;
}

const STEP_LABELS: Record<Step, string> = {
  1: 'Define',
  2: 'Notify',
  3: 'Test',
};

function StepBlock({ s, step }: { s: Step; step: Step }) {
  const done = s < step;
  const active = s === step;
  return (
    <div className="flex flex-none items-center gap-2">
      <div
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full border text-sm font-semibold',
          done && 'border-transparent bg-teal-50 text-teal-700',
          active && 'border-transparent bg-teal-700 text-white',
          !done && !active && 'border-gray-300 bg-white text-gray-400'
        )}
        data-testid={`wizard-step-circle-${s}`}
        data-active={active ? 'true' : 'false'}
        data-done={done ? 'true' : 'false'}
      >
        {s}
      </div>
      <span
        className={cn(
          'text-sm',
          active && 'font-semibold text-gray-900',
          done && 'text-gray-600',
          !done && !active && 'text-gray-400'
        )}
      >
        {STEP_LABELS[s]}
      </span>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  // 3-column grid so each step lives in an exact 1/3 of the modal width.
  // Step 1 hugs the left of column 1, step 2 sits in the centre of column 2,
  // step 3 hugs the right of column 3. Inside columns 1 and 3 the connector
  // line fills the remaining space; column 2 has connector lines on both sides
  // so step 2 ends up dead-centre regardless of label widths.
  const lineBefore = (s: Step) => (
    <div className={cn('h-px flex-1', s <= step ? 'bg-teal-700' : 'bg-gray-200')} />
  );
  const lineAfter = (s: Step) => (
    <div className={cn('h-px flex-1', s < step ? 'bg-teal-700' : 'bg-gray-200')} />
  );
  return (
    <div className="grid w-full grid-cols-3 items-center px-2 py-4" data-testid="wizard-steps">
      <div className="flex items-center gap-3">
        <StepBlock s={1} step={step} />
        {lineAfter(1)}
      </div>
      <div className="flex items-center gap-3">
        {lineBefore(2)}
        <StepBlock s={2} step={step} />
        {lineAfter(2)}
      </div>
      <div className="flex items-center gap-3">
        {lineBefore(3)}
        <StepBlock s={3} step={step} />
      </div>
    </div>
  );
}

export function AlertWizardModal({
  open,
  onOpenChange,
  onSuccess,
  alertId,
  initial,
}: AlertWizardModalProps) {
  const isEdit = !!alertId;
  const { alert: editAlert } = useAlert(isEdit ? alertId : null);

  const [step, setStep] = useState<Step>(1);
  const [defineState, setDefineState] = useState<AlertDefineState>(emptyDefineState(initial));
  const [notifyState, setNotifyState] = useState<AlertNotifyState>(emptyNotifyState());
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Reset on open / close
  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      setDefineState(emptyDefineState(initial));
      setNotifyState(emptyNotifyState());
      setStep(1);
      setStep1Errors({});
      setStep2Errors({});
    }
  }, [open, isEdit, initial?.alertType, initial?.metricId, initial?.kpiId]);

  // Prefill in edit mode
  useEffect(() => {
    if (!isEdit || !editAlert || !open) return;
    const schedule = utcCronToLocalSchedule(editAlert.schedule_cron) ?? defaultScheduleSpec();
    const isThreshold =
      editAlert.alert_type === AlertType.METRIC_THRESHOLD ||
      editAlert.alert_type === AlertType.STANDALONE;
    setDefineState({
      name: editAlert.name,
      alertType: editAlert.alert_type,
      metricId: editAlert.metric_id ?? null,
      kpiId: editAlert.kpi_id ?? null,
      standaloneConfig: editAlert.standalone_config ?? defaultStandaloneConfig(),
      conditionOperator:
        isThreshold && 'operator' in editAlert.condition ? editAlert.condition.operator : 'lt',
      conditionValue:
        isThreshold && 'value' in editAlert.condition ? String(editAlert.condition.value) : '',
      conditionRagStates:
        editAlert.alert_type === AlertType.KPI_RAG && 'rag_states' in editAlert.condition
          ? editAlert.condition.rag_states
          : [],
      schedule,
    });
    setNotifyState({
      channels: editAlert.delivery_channels,
      slackWebhookUrl: editAlert.slack_webhook_url_masked ?? '',
      slackWebhookUrlIsMasked: !!editAlert.slack_webhook_url_masked,
      messageTemplate: editAlert.message_template,
      recipients: editAlert.recipients.map<RecipientIn>((r) =>
        r.type === 'orguser'
          ? { type: 'orguser', orguser_id: r.orguser_id || 0 }
          : { type: 'external', email: r.email || '' }
      ),
    });
    setStep(1);
  }, [isEdit, editAlert, open]);

  const title = useMemo(() => {
    if (isEdit) return 'Edit alert';
    return 'Create alert';
  }, [isEdit]);

  const goNext = () => {
    if (step === 1) {
      const errs = validateStep1(defineState);
      setStep1Errors(errs);
      if (Object.keys(errs).length > 0) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      const errs = validateStep2(notifyState);
      setStep2Errors(errs);
      if (Object.keys(errs).length > 0) return;
      setStep(3);
      return;
    }
  };

  const goBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const handleSave = async () => {
    // Final validation
    const e1 = validateStep1(defineState);
    const e2 = validateStep2(notifyState);
    setStep1Errors(e1);
    setStep2Errors(e2);
    if (Object.keys(e1).length > 0) {
      setStep(1);
      return;
    }
    if (Object.keys(e2).length > 0) {
      setStep(2);
      return;
    }

    setSaving(true);
    try {
      const schedule_cron = localScheduleToUtcCron(defineState.schedule);
      const condition = buildCondition(defineState);

      if (isEdit && alertId) {
        const payload: AlertUpdatePayload = {
          name: defineState.name.trim(),
          condition,
          schedule_cron,
          delivery_channels: notifyState.channels,
          message_template: notifyState.messageTemplate,
          recipients: notifyState.recipients,
        };
        // Only send standalone_config for standalone alerts
        if (defineState.alertType === AlertType.STANDALONE) {
          payload.standalone_config = defineState.standaloneConfig;
        }
        // Send webhook URL only if user actually changed it
        if (notifyState.channels.includes('slack') && !notifyState.slackWebhookUrlIsMasked) {
          payload.slack_webhook_url = notifyState.slackWebhookUrl.trim();
        }
        const updated = await updateAlert(alertId, payload);
        toast.success('Alert updated.');
        onSuccess?.(updated);
        onOpenChange(false);
        return;
      }

      const payload: AlertCreatePayload = {
        name: defineState.name.trim(),
        alert_type: defineState.alertType,
        metric_id:
          defineState.alertType === AlertType.METRIC_THRESHOLD ? defineState.metricId : null,
        kpi_id: defineState.alertType === AlertType.KPI_RAG ? defineState.kpiId : null,
        standalone_config:
          defineState.alertType === AlertType.STANDALONE ? defineState.standaloneConfig : null,
        condition,
        schedule_cron,
        delivery_channels: notifyState.channels,
        slack_webhook_url: notifyState.channels.includes('slack')
          ? notifyState.slackWebhookUrl.trim()
          : null,
        message_template: notifyState.messageTemplate,
        recipients: notifyState.recipients,
      };
      const created = await createAlert(payload);
      toast.success('Alert created. It will run on its next scheduled time.');
      onSuccess?.(created);
      onOpenChange(false);
    } catch (err) {
      const reason =
        (err as any)?.detail || (err as any)?.message || (err as any)?.error || 'try again';
      toast.error(`Couldn't save the alert. ${reason}.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <StepIndicator step={step} />

        {step === 1 && (
          <AlertDefineStep
            value={defineState}
            onChange={setDefineState}
            sourceLocked={
              !!initial?.metricId ||
              !!initial?.kpiId ||
              isEdit ||
              defineState.alertType !== AlertType.STANDALONE
            }
            errors={step1Errors}
          />
        )}

        {step === 2 && (
          <AlertNotifyStep
            value={notifyState}
            onChange={setNotifyState}
            alertType={defineState.alertType}
            errors={step2Errors}
          />
        )}

        {step === 3 && (
          <AlertTestStep
            payload={
              {
                name: defineState.name.trim() || undefined,
                alert_type: defineState.alertType,
                metric_id:
                  defineState.alertType === AlertType.METRIC_THRESHOLD
                    ? defineState.metricId
                    : null,
                kpi_id: defineState.alertType === AlertType.KPI_RAG ? defineState.kpiId : null,
                standalone_config:
                  defineState.alertType === AlertType.STANDALONE
                    ? defineState.standaloneConfig
                    : null,
                condition: buildCondition(defineState),
                delivery_channels: notifyState.channels,
                message_template: notifyState.messageTemplate,
              } satisfies AlertTestPayload
            }
          />
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          {step > 1 && (
            <Button variant="outline" onClick={goBack} disabled={saving}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          {step < 3 && (
            <Button onClick={goNext} disabled={saving}>
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={handleSave} disabled={saving} data-testid="wizard-save">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create alert'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
