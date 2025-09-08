import { toast } from 'sonner';

/**
 * Standardized toast utilities for consistent API feedback
 */

interface ApiErrorDetails {
  message?: string;
  detail?: string;
  error?: string;
  status?: number;
  info?: any;
}

/**
 * Extract meaningful error message from various backend error formats
 */
function getErrorMessage(error: any, fallback: string = 'An error occurred'): string {
  // If error is already a string, use it
  if (typeof error === 'string') {
    return error;
  }

  // Handle Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Handle API error objects with various formats
  if (error && typeof error === 'object') {
    // Check for common backend error fields in order of preference
    if (error.detail) {
      return error.detail;
    }
    if (error.message) {
      return error.message;
    }
    if (error.error) {
      return error.error;
    }
  }

  return fallback;
}

/**
 * Success toast for API operations
 */
export const toastSuccess = {
  // Generic success
  generic: (message: string) => toast.success(message),

  // CRUD operations
  created: (itemName: string) => toast.success(`${itemName} created successfully!`),
  updated: (itemName: string) => toast.success(`${itemName} updated successfully!`),
  deleted: (itemName: string) => toast.success(`"${itemName}" deleted successfully`),
  saved: (itemName: string) => toast.success(`${itemName} saved successfully!`),

  // Specific operations
  duplicated: (itemName: string, newName?: string) =>
    toast.success(
      `Chart "${itemName}" duplicated${newName ? ` as "${newName}"` : ''} successfully!`
    ),
  shared: (itemName: string) => toast.success(`${itemName} sharing settings updated`),
  exported: (itemName: string, format: string) =>
    toast.success(`${itemName} exported as ${format.toUpperCase()} successfully!`),

  // Dashboard specific
  published: (itemName: string) => toast.success(`"${itemName}" published successfully`),
  unpublished: (itemName: string) => toast.success(`"${itemName}" unpublished successfully`),
  locked: (itemName: string) => toast.success(`"${itemName}" locked for editing`),
  unlocked: (itemName: string) => toast.success(`"${itemName}" unlocked`),
};

/**
 * Error toast for API operations with backend message extraction
 */
export const toastError = {
  // Generic error with backend message extraction
  api: (error: any, fallback: string = 'Operation failed. Please try again.') => {
    const message = getErrorMessage(error, fallback);
    toast.error(message);
  },

  // CRUD operations with backend message support
  create: (error: any, itemType: string = 'item') => {
    const message = getErrorMessage(error, `Failed to create ${itemType}. Please try again.`);
    toast.error(message);
  },

  update: (error: any, itemType: string = 'item') => {
    const message = getErrorMessage(error, `Failed to update ${itemType}. Please try again.`);
    toast.error(message);
  },

  delete: (error: any, itemName?: string) => {
    const message = getErrorMessage(
      error,
      `Failed to delete${itemName ? ` "${itemName}"` : ''}. Please try again.`
    );
    toast.error(message);
  },

  save: (error: any, itemType: string = 'changes') => {
    const message = getErrorMessage(error, `Failed to save ${itemType}. Please try again.`);
    toast.error(message);
  },

  load: (error: any, itemType: string = 'data') => {
    const message = getErrorMessage(
      error,
      `Failed to load ${itemType}. Please refresh and try again.`
    );
    toast.error(message);
  },

  // Specific operations
  duplicate: (error: any, itemName?: string) => {
    const message = getErrorMessage(
      error,
      `Failed to duplicate${itemName ? ` "${itemName}"` : ''}. Please try again.`
    );
    toast.error(message);
  },

  share: (error: any) => {
    const message = getErrorMessage(error, 'Failed to update sharing settings. Please try again.');
    toast.error(message);
  },

  export: (error: any, format?: string) => {
    const message = getErrorMessage(
      error,
      `Failed to export${format ? ` as ${format.toUpperCase()}` : ''}. Please try again.`
    );
    toast.error(message);
  },

  // Authentication
  auth: (error: any) => {
    const message = getErrorMessage(error, 'Authentication failed. Please log in again.');
    toast.error(message);
  },

  // Network/connectivity
  network: (error: any) => {
    const message = getErrorMessage(
      error,
      'Network error. Please check your connection and try again.'
    );
    toast.error(message);
  },
};

/**
 * Info toast for user guidance
 */
export const toastInfo = {
  generic: (message: string) => toast.info(message),
  autoSaved: () => toast.info('Changes auto-saved'),
  loading: (message: string) => toast.loading(message),
  noChanges: () => toast.info('No changes to save'),
  comingSoon: (feature: string) => toast.info(`${feature} will be available soon`),
};

/**
 * Promise-based toast for async operations
 */
export const toastPromise = {
  generic: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return toast.promise(promise, {
      loading: messages.loading,
      success: (data: T) =>
        typeof messages.success === 'function' ? messages.success(data) : messages.success,
      error: (error: any) =>
        typeof messages.error === 'function'
          ? messages.error(error)
          : getErrorMessage(error, messages.error as string),
    });
  },

  // Specific promise patterns
  save: <T>(promise: Promise<T>, itemName: string = 'item') =>
    toastPromise.generic(promise, {
      loading: `Saving ${itemName}...`,
      success: `${itemName} saved successfully!`,
      error: `Failed to save ${itemName}`,
    }),

  create: <T>(promise: Promise<T>, itemName: string = 'item') =>
    toastPromise.generic(promise, {
      loading: `Creating ${itemName}...`,
      success: `${itemName} created successfully!`,
      error: `Failed to create ${itemName}`,
    }),

  delete: <T>(promise: Promise<T>, itemName: string = 'item') =>
    toastPromise.generic(promise, {
      loading: `Deleting ${itemName}...`,
      success: `${itemName} deleted successfully`,
      error: `Failed to delete ${itemName}`,
    }),
};

// Export individual functions for backward compatibility
export { getErrorMessage };
