'use client';

import { useRouter } from 'next/navigation';
import { AlertForm } from '@/components/alerts/AlertForm';
import { createAlert } from '@/hooks/api/useAlerts';
import { toastSuccess, toastError } from '@/lib/toast';
import type { AlertQueryConfig } from '@/types/alert';

export default function NewAlertPage() {
  const router = useRouter();

  const handleSave = async (data: {
    name: string;
    query_config: AlertQueryConfig;
    cron: string;
    recipients: string[];
    message: string;
  }) => {
    try {
      await createAlert(data);
      toastSuccess.created('Alert');
      router.push('/alerts');
    } catch (error: unknown) {
      toastError.create(error, 'alert');
    }
  };

  return <AlertForm onSave={handleSave} onCancel={() => router.push('/alerts')} />;
}
