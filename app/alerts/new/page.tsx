'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { AlertForm } from '@/components/alerts/AlertForm';
import { createAlert } from '@/hooks/api/useAlerts';
import { toastSuccess, toastError } from '@/lib/toast';
import type { AlertQueryConfig, MetricRagLevel } from '@/types/alert';

export default function NewAlertPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Prefer ?kpi_id=; fall back to ?metric_id= for backwards-compat links.
  const kpiIdParam = searchParams.get('kpi_id') ?? searchParams.get('metric_id');

  const handleSave = async (data: {
    name: string;
    alert_type: 'threshold' | 'rag' | 'standalone';
    kpi_id?: number | null;
    metric_id?: number | null;
    metric_rag_level?: MetricRagLevel | null;
    query_config: AlertQueryConfig;
    recipients: string[];
    pipeline_triggers?: string[];
    notification_cooldown_days?: number | null;
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
        initialKPIId={kpiIdParam ? Number(kpiIdParam) : null}
        onSave={handleSave}
        onCancel={() => router.push('/alerts')}
      />
    </div>
  );
}
