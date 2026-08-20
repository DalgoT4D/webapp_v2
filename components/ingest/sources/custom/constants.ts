// Airbyte source-definition names used to resolve a custom form (see registry).
export const SOURCE_NAME_GOOGLE_SHEETS = 'Google Sheets';
export const SOURCE_NAME_KOBOTOOLBOX = 'KoboToolbox';

// Google Sheets `credentials` oneOf: the block's own key, its discriminator, and the
// discriminator values. The block is never rendered from the spec — the Google sign-in
// button and the service-account field stand in for it.
export const GSHEETS_KEY_CREDENTIALS = 'credentials';
export const GSHEETS_AUTH_DISCRIMINATOR = 'auth_type';
export const GSHEETS_OAUTH_AUTH_TYPE = 'Client';
export const GSHEETS_SERVICE_AUTH_TYPE = 'Service';

// The auth-method radio's values — deliberately not the discriminator values above, so a spec
// rename of either branch can't silently change which fields the form renders.
export const GSHEETS_AUTH_METHOD_OAUTH = 'oauth';
export const GSHEETS_AUTH_METHOD_SERVICE = 'service';
export type GsheetsAuthMethodValue =
  | typeof GSHEETS_AUTH_METHOD_OAUTH
  | typeof GSHEETS_AUTH_METHOD_SERVICE;

// Google Sheets field keys. These place fields (pin to primary / render with a custom
// widget) — they are NOT an allowlist: the form renders every field the spec sends.
export const GSHEETS_KEY_SPREADSHEET = 'spreadsheet_id';
export const GSHEETS_KEY_SERVICE_INFO = 'service_account_info';

// KoboToolbox field keys / serialization.
export const KOBO_KEY_START_TIME = 'start_time';
// The date picker yields a day; time is fixed so the value matches the spec pattern.
export const KOBO_START_TIME_SUFFIX = 'T00:00:00';
