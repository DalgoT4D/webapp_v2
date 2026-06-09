export interface Warehouse {
  wtype: string;
  name: string;
  destinationId: string;
  destinationDefinitionId: string;
  icon: string;
  airbyteDockerRepository: string;
  tag: string;
  airbyteWorkspaceId?: string;
  connectionConfiguration: Record<string, unknown>;
}

export interface DestinationDefinition {
  destinationDefinitionId: string;
  name: string;
  icon?: string;
  dockerRepository?: string;
  dockerImageTag?: string;
}

export interface WarehouseTableRow {
  label: string;
  value: string | undefined;
  link?: string;
}
