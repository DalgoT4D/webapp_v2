/**
 * Shared configuration constants for the application
 */

/**
 * Backend API base URL
 * Falls back to localhost:8002 for local development
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';
