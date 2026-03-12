'use client';

import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { apiGet } from './api';

// Use existing API infrastructure for SWR fetcher
const defaultFetcher = (url: string) => {
  // Never use authenticated API for public endpoints
  if (url.includes('/api/v1/public/')) {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';
    return fetch(`${backendUrl}${url}`).then((res) => {
      if (!res.ok) throw new Error('Failed to fetch public data');
      return res.json();
    });
  }
  return apiGet(url);
};

// Production-ready SWR configuration
const swrConfig = {
  fetcher: defaultFetcher,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  loadingTimeout: 10000,
  onError: (error: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('SWR Error:', error);
    }
  },
};

interface SWRProviderProps {
  children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
