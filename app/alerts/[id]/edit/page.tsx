'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { AlertForm } from '@/components/alerts/AlertForm';
import { useAlert, updateAlert } from '@/hooks/api/useAlerts';
import { toastSuccess, toastError } from '@/lib/toast';
import type { AlertQueryConfig, MetricRagLevel } from '@/types/alert';

export default function EditAlertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const alertId = parseInt(id, 10);
  const router = useRouter();
  const { alert, isLoading } = useAlert(alertId);

  const handleSave = async (data: {
    name: string;
    metric_id?: number | null;
    metric_rag_level?: MetricRagLevel | null;
    query_config: AlertQueryConfig;
    recipients: string[];
    message: string;
    group_message?: string;
  }) => {
    try {
      await updateAlert(alertId, data);
      toastSuccess.updated('Alert');
      router.push(`/alerts/${alertId}`);
    } catch (error: unknown) {
      toastError.save(error, 'alert');
    }
  };

  if (isLoading || !alert) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading alert...</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <AlertForm
        alert={alert}
        onSave={handleSave}
        onCancel={() => router.push(`/alerts/${alertId}`)}
      />
    </div>
  );
}
