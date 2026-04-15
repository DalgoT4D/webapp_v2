'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { AlertForm } from '@/components/alerts/AlertForm';
import { createAlert } from '@/hooks/api/useAlerts';
import { toastSuccess, toastError } from '@/lib/toast';
import type { AlertQueryConfig, MetricRagLevel } from '@/types/alert';

export default function NewAlertPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMetricId = searchParams.get('metric_id');

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
      await createAlert(data);
      toastSuccess.created('Alert');
      router.push('/alerts');
    } catch (error: unknown) {
      toastError.create(error, 'alert');
    }
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <AlertForm
        initialMetricId={initialMetricId ? Number(initialMetricId) : null}
        onSave={handleSave}
        onCancel={() => router.push('/alerts')}
      />
    </div>
  );
}
