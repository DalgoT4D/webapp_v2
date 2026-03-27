// stores/exploreStore.ts
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SelectedTable {
  schema: string;
  table: string;
}

interface ExploreState {
  // Selected table
  selectedTable: SelectedTable | null;
  setSelectedTable: (table: SelectedTable | null) => void;

  // Active tab
  activeTab: 'preview' | 'statistics';
  setActiveTab: (tab: 'preview' | 'statistics') => void;

  // Sidebar width (for persistence)
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;

  // Search term for tree
  searchTerm: string;
  setSearchTerm: (term: string) => void;

  // Reset state
  reset: () => void;
}

const initialState = {
  selectedTable: null as SelectedTable | null,
  activeTab: 'preview' as const,
  sidebarWidth: 280,
  searchTerm: '',
};

export const useExploreStore = create<ExploreState>()(
  persist(
    (set) => ({
      ...initialState,

      setSelectedTable: (table) => set({ selectedTable: table }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      setSearchTerm: (term) => set({ searchTerm: term }),

      reset: () => set(initialState),
    }),
    {
      name: 'explore-storage',
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
);
