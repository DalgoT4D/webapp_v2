// Airbyte source-definition names used to resolve a custom form (see registry).
export const SOURCE_NAME_GOOGLE_SHEETS = 'Google Sheets';
export const SOURCE_NAME_KOBOTOOLBOX = 'KoboToolbox';

// Google Sheets `credentials` oneOf discriminator (auth_type) values.
export const GSHEETS_OAUTH_AUTH_TYPE = 'Client';
export const GSHEETS_SERVICE_AUTH_TYPE = 'Service';

// Google Sheets field keys.
export const GSHEETS_KEY_SPREADSHEET = 'spreadsheet_id';
export const GSHEETS_KEY_NAMES_CONVERSION = 'names_conversion';
export const GSHEETS_KEY_SERVICE_INFO = 'service_account_info';

// KoboToolbox field keys / serialization.
export const KOBO_KEY_START_TIME = 'start_time';
// The date picker yields a day; time is fixed so the value matches the spec pattern.
export const KOBO_START_TIME_SUFFIX = 'T00:00:00';
