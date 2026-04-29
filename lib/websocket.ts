/** Custom WebSocket close codes (must match backend WebsocketCloseCodes) */
export const WS_CLOSE_CODES = {
  NO_TOKEN: 4001,
  INVALID_TOKEN: 4003,
} as const;

const AUTH_CLOSE_CODES: number[] = [WS_CLOSE_CODES.NO_TOKEN, WS_CLOSE_CODES.INVALID_TOKEN];

export function isAuthCloseCode(code: number): boolean {
  return AUTH_CLOSE_CODES.includes(code);
}

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';

/**
 * Generate a WebSocket URL for the backend.
 * Converts http(s) to ws(s) and appends the org slug query param.
 *
 * Auth: webapp_v2 uses cookie-based auth — the browser sends the
 * `access_token` httpOnly cookie automatically with the WS handshake.
 * No token query param needed.
 */
export function generateWebSocketUrl(relativePath: string): string {
  const selectedOrg =
    typeof window !== 'undefined' ? localStorage.getItem('selectedOrg') || '' : '';

  const wsBase = API_BASE_URL.replace(/^http/, 'ws');

  const params = new URLSearchParams();
  if (selectedOrg) {
    params.set('orgslug', selectedOrg);
  }

  const queryString = params.toString();
  return `${wsBase}/wss/${relativePath}${queryString ? `?${queryString}` : ''}`;
}
