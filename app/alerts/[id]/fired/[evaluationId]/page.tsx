'use client';

import { use } from 'react';
import { TriggeredAlertDetail } from '@/components/alerts/TriggeredAlertDetail';

export default function TriggeredAlertDetailPage({
  params,
}: {
  params: Promise<{ id: string; evaluationId: string }>;
}) {
  const { id, evaluationId } = use(params);

  return (
    <TriggeredAlertDetail alertId={parseInt(id, 10)} evaluationId={parseInt(evaluationId, 10)} />
  );
}
