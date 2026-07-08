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

/** Response from starting the Google OAuth flow */
export interface SourceOAuthConsent {
  consentUrl: string;
  state: string;
}

/** Payload to complete the Google OAuth flow after the user consents */
export interface CompleteSourceOAuthPayload {
  sourceDefId: string;
  state: string;
  queryParams: Record<string, string>;
}
