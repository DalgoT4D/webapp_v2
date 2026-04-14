import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type { Warehouse, DestinationDefinition } from '@/types/warehouse';
import type { ConnectionSpecification } from '@/components/connectors/types';
import { WAREHOUSE_API } from '@/constants/warehouse';

// ============ Raw API Response Types ============

interface WarehouseApiItem {
  wtype: string;
  name: string;
  airbyte_destination: {
    destinationDefinitionId: string;
    destinationId: string;
    workspaceId?: string;
    connectionConfiguration: Record<string, unknown>;
    name: string;
    destinationName: string;
    icon: string;
  };
  airbyte_docker_repository: string;
  airbyte_docker_image_tag: string;
}

interface WarehouseListResponse {
  warehouses: WarehouseApiItem[];
}

/** Maps the raw API warehouse item to the flat Warehouse type used by UI */
function mapWarehouseResponse(raw: WarehouseApiItem): Warehouse {
  return {
    wtype: raw.wtype,
    name: raw.name,
    destinationId: raw.airbyte_destination.destinationId,
    destinationDefinitionId: raw.airbyte_destination.destinationDefinitionId,
    icon: raw.airbyte_destination.icon,
    connectionConfiguration: raw.airbyte_destination.connectionConfiguration ?? {},
    airbyteDockerRepository: raw.airbyte_docker_repository,
    tag: raw.airbyte_docker_image_tag,
    airbyteWorkspaceId: raw.airbyte_destination.workspaceId,
  };
}

// ============ SWR Read Hooks ============

/** Current warehouse for the org (single warehouse per org) */
export function useWarehouse() {
  const { data, error, mutate, isLoading } = useSWR<WarehouseListResponse>(
    WAREHOUSE_API.LIST,
    apiGet,
    { revalidateOnFocus: false }
  );
  const warehouse = data?.warehouses?.[0] ? mapWarehouseResponse(data.warehouses[0]) : undefined;
  return { data: warehouse, isLoading, isError: error, mutate };
}

/** Available destination type definitions */
export function useDestinationDefinitions() {
  const { data, error, isLoading } = useSWR<DestinationDefinition[]>(
    WAREHOUSE_API.DESTINATION_DEFINITIONS,
    apiGet,
    { revalidateOnFocus: false }
  );
  return { data: data || [], isLoading, isError: error };
}

/** Raw API response wraps the spec in a connectionSpecification key */
interface SpecResponse {
  connectionSpecification: ConnectionSpecification;
}

/** Unwrap the spec from the API response envelope */
function unwrapSpec(
  data: SpecResponse | ConnectionSpecification | undefined
): ConnectionSpecification | undefined {
  if (!data) return undefined;
  if ('connectionSpecification' in data) return data.connectionSpecification;
  return data;
}

/** Spec for a selected destination definition (for creating new warehouse) */
export function useDestinationSpec(defId: string | null) {
  const { data, error, isLoading } = useSWR<SpecResponse>(
    defId ? WAREHOUSE_API.DESTINATION_SPEC(defId) : null,
    apiGet,
    { revalidateOnFocus: false }
  );
  return { data: unwrapSpec(data), isLoading, isError: error };
}

/** Spec for an existing destination (for editing warehouse) */
export function useDestinationEditSpec(destId: string | null) {
  const { data, error, isLoading } = useSWR<SpecResponse>(
    destId ? WAREHOUSE_API.DESTINATION_EDIT_SPEC(destId) : null,
    apiGet,
    { revalidateOnFocus: false }
  );
  return { data: unwrapSpec(data), isLoading, isError: error };
}

// ============ Mutation Functions ============

export async function createWarehouse(payload: {
  wtype: string;
  name: string;
  destinationDefId: string;
  airbyteConfig: Record<string, unknown>;
}): Promise<Warehouse> {
  return apiPost(WAREHOUSE_API.CREATE, payload);
}

export async function updateWarehouse(
  destId: string,
  payload: {
    name: string;
    config: Record<string, unknown>;
    destinationDefId: string;
  }
): Promise<Warehouse> {
  return apiPut(WAREHOUSE_API.UPDATE(destId), payload);
}

export async function deleteWarehouse(): Promise<void> {
  return apiDelete(WAREHOUSE_API.DELETE);
}
