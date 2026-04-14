'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertForm } from '@/components/alerts/AlertForm';
import { createAlert } from '@/hooks/api/useAlerts';
import { toastError, toastSuccess } from '@/lib/toast';
import type { AlertMessagePlaceholder, AlertQueryConfig } from '@/types/alert';

interface MetricAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metricId: number | null;
  metricName?: string | null;
  onCreated?: () => void | Promise<void>;
}

export function MetricAlertDialog({
  open,
  onOpenChange,
  metricId,
  metricName,
  onCreated,
}: MetricAlertDialogProps) {
  if (!metricId) return null;

  const handleSave = async (data: {
    name: string;
    metric_id?: number | null;
    query_config: AlertQueryConfig;
    recipients: string[];
    message: string;
    group_message?: string;
    message_placeholders: AlertMessagePlaceholder[];
  }) => {
    try {
      await createAlert(data);
      toastSuccess.created('Alert');
      await onCreated?.();
      onOpenChange(false);
    } catch (error: unknown) {
      toastError.create(error, 'alert');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[94vh] w-[min(96vw,1560px)] max-w-[min(96vw,1560px)] overflow-hidden p-0">
        <AlertForm
          compact
          initialMetricId={metricId}
          title={`Create alert for ${metricName || 'metric'}`}
          onSave={handleSave}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
