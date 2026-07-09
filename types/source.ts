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

/** Payload to complete the Google OAuth flow and save the source in one step.
 * The backend exchanges the code, injects the credentials server-side, and creates
 * (or updates, when sourceId is set) the source — no credentials reach the browser. */
export interface CompleteSourceOAuthPayload {
  sourceDefId: string;
  name: string;
  config: Record<string, unknown>;
  state: string;
  queryParams: Record<string, string>;
  sourceId?: string;
}

/** Response from completing the OAuth flow: the saved source's id */
export interface CompleteSourceOAuthResponse {
  sourceId: string;
}
