export interface Source {
  sourceId: string;
  name: string;
  sourceDefinitionId: string;
  sourceName: string; // type label, e.g., "Postgres"
  icon?: string;
  createdAt?: number; // unix seconds, from Airbyte; used to sort newest-first
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

/** Response from starting the Google OAuth flow (Variant A): the Google consent URL
 * Dalgo built. The state nonce stays server-side and never reaches the browser. */
export interface SourceOAuthConsent {
  authUrl: string;
}

/** Payload to create (or update) the source from a redeemed OAuth `ref`. The backend
 * has already exchanged the code and stashed the refresh token server-side under `ref`;
 * here it redeems the ref, injects the credentials, and creates (or updates, when
 * sourceId is set) the source — no credentials or tokens reach the browser. */
export interface CreateOAuthSourcePayload {
  sourceDefId: string;
  name: string;
  config: Record<string, unknown>;
  ref: string;
  sourceId?: string;
}

/** Response from creating the OAuth source: the saved source's id */
export interface CreateOAuthSourceResponse {
  sourceId: string;
}
