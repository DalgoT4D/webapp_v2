import { useCallback } from 'react';

interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function useToast() {
  const toast = useCallback(({ title, description, variant = 'default' }: ToastOptions) => {
    // For now, just use console.log
    console.log(`[${variant.toUpperCase()}] ${title}${description ? `: ${description}` : ''}`);
  }, []);

  return { toast };
}
