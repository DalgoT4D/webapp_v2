// Centralized API config and fetch utility

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';

// Placeholder for getting auth token (to be implemented)
function getAuthToken() {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken');
    console.log('Auth token present:', !!token);
    return token || undefined;
  }
  return undefined;
}

function getSelectOrg() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('selectedOrg') || undefined;
  }
  return undefined;
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

async function apiFetch(path: string, options: RequestInit = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const headers: HeadersInit = {
    ...(options.headers || {}),
    ...getHeaders(),
  };

  console.log('API Fetch:', {
    url,
    method: options.method,
    headers,
  });

  try {
    const response = await fetch(url, { ...options, headers });

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

    console.log('API Response:', {
      status: response.status,
      ok: response.ok,
      contentType,
      data,
    });

    if (!response.ok) {
      // Log full error details
      console.error('API Error Details:', {
        url,
        method: options.method,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
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
    console.error('API Fetch Error:', error);
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
  console.log('API POST Request:', {
    path,
    body,
    headers: getHeaders(),
  });

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
