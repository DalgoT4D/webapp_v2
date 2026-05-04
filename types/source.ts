export interface Source {
  sourceId: string;
  name: string;
  sourceDefinitionId: string;
  sourceName: string; // type label, e.g., "Postgres"
  icon?: string;
  connectionConfiguration: Record<string, unknown>;
}

export interface SourceDefinition {
  sourceDefinitionId: string;
  name: string;
  icon?: string;
  dockerRepository?: string;
  dockerImageTag?: string; // version label, e.g., "0.4.28"
}

export interface CreateSourcePayload {
  name: string;
  sourceDefId: string;
  config: Record<string, unknown>;
}

export interface UpdateSourcePayload {
  name: string;
  sourceDefId: string;
  config: Record<string, unknown>;
  sourceId: string;
}
