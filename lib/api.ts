// Centralized API config and fetch utility

import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';

// Track ongoing refresh request to prevent multiple simultaneous refreshes
let isRefreshing = false;
let refreshPromise: Promise<string | null> = Promise.resolve(null);

// Placeholder for getting auth token (to be implemented)
function getAuthToken() {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken');
    return token || undefined;
  }
  return undefined;
}

function getRefreshToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('refreshToken') || undefined;
  }
  return undefined;
}

function getSelectOrg() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('selectedOrg') || undefined;
  }
  return undefined;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    console.error('No refresh token available');
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', response.status, response.statusText);

      // If refresh token is invalid (401, 403), clear it
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('authToken');
      }

      return null;
    }

    const data = await response.json();
    const newAccessToken = data.token;

    if (newAccessToken) {
      // Update localStorage and auth store
      localStorage.setItem('authToken', newAccessToken);

      // Update auth store if available
      if (typeof window !== 'undefined') {
        const store = useAuthStore.getState();
        store.setToken(newAccessToken);
      }

      return newAccessToken;
    }

    console.error('No token in refresh response');
    return null;
  } catch (error) {
    console.error('Error refreshing token:', error);

    // On network errors, don't clear tokens - they might be temporary
    return null;
  }
}

function getHeaders() {
  const token = getAuthToken();
  const selectedOrgSlug = getSelectOrg();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

    // Clear all auth-related data
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
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
    const response = await fetch(url, { ...options, headers });

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

        const newToken = await refreshPromise;

        if (newToken) {
          // Retry the original request with the new token
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
          errorMessage = data.detail;
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
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.blob();
}
