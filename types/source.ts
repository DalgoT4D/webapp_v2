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
  /** Source-DEFINITION name (e.g. "Google Sheets"). Tells the backend whether to fill in
   *  Dalgo's managed service-account key. */
  sourceDefName: string;
}

export interface UpdateSourcePayload {
  name: string;
  sourceDefId: string;
  config: Record<string, unknown>;
  sourceId: string;
  /** Source-DEFINITION name (e.g. "Google Sheets"). Tells the backend whether to fill in
   *  Dalgo's managed service-account key. */
  sourceDefName: string;
}

/** Response from starting the Google OAuth flow (Variant A): the Google consent URL
 * Dalgo built. The state nonce stays server-side and never reaches the browser. */
export interface SourceOAuthConsent {
  authUrl: string;
}

/** What the browser needs to open the Google Picker, for a `ref` the caller owns.
 *
 * Dalgo asks Google for the `drive.file` scope, which grants only the files the user hands
 * us through the Picker — so between consent and save the browser has to run it, and that
 * needs a Drive-scoped access token client-side. It is short-lived, scoped to files the user
 * selects, and fetched per flow; the refresh token never leaves the backend. */
export interface SourceOAuthPickerConfig {
  accessToken: string;
  apiKey: string;
  /** the OAuth client's Google Cloud project NUMBER */
  appId: string;
}

/** Payload to create a NEW source from a redeemed OAuth `ref`. The backend has already
 * exchanged the code and stashed the refresh token server-side under `ref`; here it
 * redeems the ref, injects the credentials, and creates the source — no credentials or
 * tokens reach the browser. To re-authenticate an EXISTING source, use
 * `UpdateOAuthSourcePayload` + `updateOAuthSource` instead — the create endpoint always
 * creates a new source and has no sourceId field. */
export interface CreateOAuthSourcePayload {
  sourceDefId: string;
  /** source-definition NAME (e.g. "Google Sheets") — the OAuth registry key */
  sourceName: string;
  name: string;
  config: Record<string, unknown>;
  /** opaque handle the backend minted for the stashed refresh_token */
  refresh_token_ref: string;
}

/** Same shape as create, minus sourceId — that goes in the URL (PUT /sources/oauth/{id}). */
export type UpdateOAuthSourcePayload = CreateOAuthSourcePayload;

/** Response from creating the OAuth source: the saved source's id */
export interface CreateOAuthSourceResponse {
  sourceId: string;
}

/** MANAGED-SA bridge — the Dalgo service account users share their spreadsheet with. */
export interface ManagedServiceAccount {
  /** null when no usable key is configured — that IS the "bridge is off" signal. */
  email: string | null;
}
