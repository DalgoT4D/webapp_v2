import { useState, useEffect } from 'react';

interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface Toast extends ToastOptions {
  id: string;
}

let toastCount = 0;
const toasts: Toast[] = [];
const listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function toast(options: ToastOptions) {
  const id = String(toastCount++);
  const newToast: Toast = { ...options, id };
  toasts.push(newToast);
  emitChange();

  // Auto-remove after 5 seconds
  setTimeout(() => {
    const index = toasts.findIndex((t) => t.id === id);
    if (index > -1) {
      toasts.splice(index, 1);
      emitChange();
    }
  }, 5000);
}

export function useToast() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.push(listener);

    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    toast,
    toasts: [...toasts],
    dismiss: (id: string) => {
      const index = toasts.findIndex((t) => t.id === id);
      if (index > -1) {
        toasts.splice(index, 1);
        emitChange();
      }
    },
  };
}
