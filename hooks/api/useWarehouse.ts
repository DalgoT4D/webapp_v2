import useSWR from 'swr';
import { apiGet } from '@/lib/api';

export function useSchemas() {
  return useSWR('/api/warehouse/schemas/', apiGet);
}

export function useTables(schema: string | null) {
  return useSWR(schema ? `/api/warehouse/tables/?schema_name=${schema}` : null, apiGet);
}

export function useColumns(schema: string | null, table: string | null) {
  return useSWR(
    schema && table ? `/api/warehouse/columns/?schema_name=${schema}&table_name=${table}` : null,
    apiGet
  );
}
