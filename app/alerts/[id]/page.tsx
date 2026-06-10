'use client';

import { use } from 'react';
import { AlertDetail } from '@/components/alerts/AlertDetail';

export default function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AlertDetail alertId={parseInt(id, 10)} />;
}
