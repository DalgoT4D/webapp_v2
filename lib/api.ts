// Centralized API config and fetch utility

import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';

// Track ongoing refresh request to prevent multiple simultaneous refreshes
let isRefreshing = false;
let refreshPromise: Promise<boolean> = Promise.resolve(false);

function getSelectOrg() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('selectedOrg') || undefined;
  }
  return undefined;
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v2/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send cookies with request
    });

    if (!response.ok) {
      console.error('Token refresh failed:', response.status, response.statusText);
      return false;
    }

    // Cookie is automatically set by the server response
    return true;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return false;
  }
}

function getHeaders() {
  const selectedOrgSlug = getSelectOrg();
  return {
    'Content-Type': 'application/json',
    // No Authorization header needed - cookies are sent automatically
    ...(selectedOrgSlug ? { 'x-dalgo-org': selectedOrgSlug } : {}),
  };
}

function handleAuthFailure() {
  if (typeof window !== 'undefined') {
    // Don't redirect if we're on a public dashboard page
    const currentPath = window.location.pathname;
    if (
      currentPath.startsWith('/share/dashboard/') ||
      currentPath.startsWith('/public/dashboard/')
    ) {
      console.log('[handleAuthFailure] Ignoring auth failure on public dashboard');
      return;
    }

    // Clear organization selection
    localStorage.removeItem('selectedOrg');

    // Update auth store
    const store = useAuthStore.getState();
    store.logout();

    // Navigate to login page
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
}

async function apiFetch(path: string, options: RequestInit = {}, retryCount = 0): Promise<any> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const headers: HeadersInit = {
    ...(options.headers || {}),
    ...getHeaders(),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Always include cookies
    });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      // If this is the first attempt, try to refresh the token
      if (retryCount === 0) {
        // Prevent multiple simultaneous refresh attempts
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = refreshAccessToken().finally(() => {
            isRefreshing = false;
          });
        }

        const success = await refreshPromise;

        if (success) {
          // Retry the original request with the new token cookie
          return apiFetch(path, options, retryCount + 1);
        }
      }

      // Either refresh failed or this is a retry that still got 401
      // In both cases, logout the user
      handleAuthFailure();
      throw new Error('Authentication failed. Please log in again.');
    }

    // Check if response has JSON content
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        data = { error: 'Invalid JSON response from server' };
      }
    } else {
      // Non-JSON response (could be HTML error page, text, etc.)
      const text = await response.text();
      console.error('Non-JSON response:', text);
      data = { error: `Server returned non-JSON response: ${text.substring(0, 100)}...` };
    }

    if (!response.ok) {
      // Simplified error logging
      console.error('🚨 API Error:', {
        url,
        method: options.method || 'GET',
        status: response.status,
        statusText: response.statusText,
        responseData: data,
        timestamp: new Date().toISOString(),
      });

      // Handle different error formats from the backend
      let errorMessage = 'API request failed';

      if (data) {
        if (data.detail) {
          // Handle array of validation errors
          if (Array.isArray(data.detail)) {
            // Extract messages from validation error array
            const messages = data.detail.map((err: any) => {
              if (err.msg) {
                // Include field location if available
                const location = err.loc && err.loc.length > 0 ? err.loc[err.loc.length - 1] : null;
                return location ? `${location}: ${err.msg}` : err.msg;
              }
              return typeof err === 'string' ? err : JSON.stringify(err);
            });
            errorMessage = messages.join(', ');
          } else if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } else {
            errorMessage = JSON.stringify(data.detail);
          }
        } else if (data.error) {
          errorMessage = data.error;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (typeof data === 'string') {
          errorMessage = data;
        } else {
          errorMessage = `API error: ${response.status} ${response.statusText}`;
        }
      }

      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error('🔥 API Network Error:', error?.message || error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred');
  }
}

// Helper for GET requests
export function apiGet(path: string, options: RequestInit = {}) {
  return apiFetch(path, { ...options, method: 'GET' });
}

// Helper for POST requests
export function apiPost(path: string, body: any, options: RequestInit = {}) {
  return apiFetch(path, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Helper for PUT requests
export function apiPut(path: string, body: any, options: RequestInit = {}) {
  return apiFetch(path, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// Helper for DELETE requests
export function apiDelete(path: string, options: RequestInit = {}) {
  return apiFetch(path, { ...options, method: 'DELETE' });
}

// Helper for POST requests that return binary data
export async function apiPostBinary(path: string, body: any, options: RequestInit = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const headers: HeadersInit = {
    ...getHeaders(),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include', // Include cookies
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.blob();
}
