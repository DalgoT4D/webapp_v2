'use client';

import { useEffect, useState } from 'react';
import {
  type DashboardChatPIIColumn,
  useDashboardAIChatActions,
  useDashboardPIIColumns,
} from '@/hooks/api/useDashboardAIChat';
import { DashboardChatPIICard } from '@/components/settings/dashboard-chat-pii-card';
import { getDashboardChatPIIColumnKey } from '@/components/settings/dashboard-chat-pii-utils';
import { SettingsStateCard } from '@/components/settings/settings-state-card';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { trackEvent } from '@/lib/analytics';
import { toastError, toastSuccess } from '@/lib/toast';

interface DashboardChatPIISettingsCardProps {
  enabled: boolean;
  refreshToken: number;
}

export function DashboardChatPIISettingsCard({
  enabled,
  refreshToken,
}: DashboardChatPIISettingsCardProps) {
  const {
    piiColumns,
    isLoading: piiColumnsLoading,
    error: piiColumnsError,
    mutate: mutatePIIColumns,
  } = useDashboardPIIColumns(enabled);
  const { updatePIIColumnOverrides } = useDashboardAIChatActions();
  const [updatingPIIColumnKey, setUpdatingPIIColumnKey] = useState<string | null>(null);

  useEffect(() => {
    if (enabled) {
      mutatePIIColumns();
    }
  }, [enabled, mutatePIIColumns, refreshToken]);

  const updateColumnPiiOverride = async (column: DashboardChatPIIColumn, pii: boolean) => {
    const key = getDashboardChatPIIColumnKey(column);
    setUpdatingPIIColumnKey(key);
    try {
      await updatePIIColumnOverrides({
        overrides: [
          {
            schema_name: column.schema_name,
            table_name: column.table_name,
            column_name: column.column_name,
            pii,
          },
        ],
      });
      await mutatePIIColumns();
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_CHAT_PII_COLUMN_REVIEWED, {
        pii,
      });
      toastSuccess.generic('PII column review saved');
    } catch (error) {
      toastError.api(error, 'Failed to save PII column review. Please try again.');
    } finally {
      setUpdatingPIIColumnKey(null);
    }
  };

  if (piiColumnsError) {
    return (
      <SettingsStateCard
        title="PII column review"
        description={
          piiColumnsError instanceof Error
            ? piiColumnsError.message
            : 'Unable to load PII column review data.'
        }
      />
    );
  }

  return (
    <DashboardChatPIICard
      columns={piiColumns?.columns ?? []}
      totalColumnCount={piiColumns?.total_column_count ?? 0}
      piiColumnCount={piiColumns?.pii_column_count ?? 0}
      isLoading={piiColumnsLoading}
      updatingColumnKey={updatingPIIColumnKey}
      onColumnPIIChange={updateColumnPiiOverride}
    />
  );
}
