'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  type DashboardChatPIIColumn,
  useDashboardAIChatActions,
  useDashboardPIIColumns,
} from '@/hooks/api/useDashboardAIChat';
import { DashboardChatPIICard } from '@/components/settings/dashboard-chat-pii-card';
import { SettingsStateCard } from '@/components/settings/settings-state-card';

interface DashboardChatPIISettingsCardProps {
  enabled: boolean;
  refreshToken: number;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return 'Please try again.';
}

function columnKey(
  column: Pick<DashboardChatPIIColumn, 'schema_name' | 'table_name' | 'column_name'>
) {
  return `${column.schema_name}.${column.table_name}.${column.column_name}`;
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
    const key = columnKey(column);
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
      toast.success('PII column review saved');
    } catch (error) {
      toast.error(`Failed to save PII column review: ${getErrorMessage(error)}`);
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
