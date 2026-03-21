// hooks/api/useTaskTemplates.ts
'use client';

import useSWR from 'swr';
import { apiGet, apiPost, apiPut } from '@/lib/api';

// Task template types
export interface TaskTemplate {
  slug: string;
  label: string;
  command: string;
}

export interface TaskConfig {
  flags: string[]; // Array of flag strings
  options: string[]; // Array of option key strings
}

// Fetch all available task templates
export function useTaskTemplates() {
  return useSWR<TaskTemplate[]>('/api/data/tasks/', apiGet, {
    revalidateOnFocus: false,
  });
}

// Fetch task configuration (flags and options)
export function useTaskConfig(taskSlug: string | null) {
  return useSWR<TaskConfig>(taskSlug ? `/api/data/tasks/${taskSlug}/config/` : null, apiGet, {
    revalidateOnFocus: false,
  });
}

// Create custom task (mutation)
export async function createCustomTask(data: {
  task_slug: string;
  flags?: string[];
  options?: Record<string, string>;
}) {
  return apiPost('/api/prefect/tasks/', data);
}

// Update task configuration (mutation)
export async function updateTaskConfig(
  taskUuid: string,
  data: {
    label?: string;
    flags?: string[];
    options?: Record<string, string>;
  }
) {
  return apiPut(`/api/prefect/tasks/${taskUuid}/`, data);
}
