// stores/transformStore.ts
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TransformState {
  // Tab state
  activeTab: 'ui' | 'github';
  setActiveTab: (tab: 'ui' | 'github') => void;

  // Workspace state
  workspaceSetup: boolean;
  setWorkspaceSetup: (setup: boolean) => void;

  // Git connection
  gitConnected: boolean;
  setGitConnected: (connected: boolean) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  activeTab: 'ui' as const,
  workspaceSetup: false,
  gitConnected: false,
};

export const useTransformStore = create<TransformState>()(
  persist(
    (set) => ({
      ...initialState,

      setActiveTab: (tab) => set({ activeTab: tab }),

      setWorkspaceSetup: (setup) => set({ workspaceSetup: setup }),

      setGitConnected: (connected) => set({ gitConnected: connected }),

      reset: () => set(initialState),
    }),
    {
      name: 'transform-storage',
      partialize: (state) => ({
        activeTab: state.activeTab,
      }),
    }
  )
);
