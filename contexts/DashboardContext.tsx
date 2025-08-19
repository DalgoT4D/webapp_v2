'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type DashboardApiMode = 'authenticated' | 'public';

interface DashboardContextValue {
  apiMode: DashboardApiMode;
  setApiMode: (mode: DashboardApiMode) => void;
  publicToken?: string;
  setPublicToken: (token?: string) => void;
  isPublicAccess: boolean;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

interface DashboardProviderProps {
  children: ReactNode;
  initialMode?: DashboardApiMode;
  initialToken?: string;
}

export function DashboardProvider({
  children,
  initialMode = 'authenticated',
  initialToken,
}: DashboardProviderProps) {
  const [apiMode, setApiMode] = useState<DashboardApiMode>(initialMode);
  const [publicToken, setPublicToken] = useState<string | undefined>(initialToken);

  const isPublicAccess = apiMode === 'public' && !!publicToken;

  return (
    <DashboardContext.Provider
      value={{
        apiMode,
        setApiMode,
        publicToken,
        setPublicToken,
        isPublicAccess,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
}

// Helper hook for getting the appropriate API base URL
export function useApiBaseUrl() {
  const { isPublicAccess } = useDashboardContext();

  // Return the appropriate base URL based on context
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';

  if (isPublicAccess) {
    return `${backendUrl}/api/v1/public`;
  }

  return `${backendUrl}/api`;
}
