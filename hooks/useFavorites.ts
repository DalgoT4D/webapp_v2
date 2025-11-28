/**
 * Custom hook for managing favorites state
 * Provides toggle functionality with optional localStorage persistence
 */

import { useState, useCallback, useEffect } from 'react';

export interface UseFavoritesOptions {
  /** Optional localStorage key for persistence */
  storageKey?: string;
  /** Initial favorites (used when no storage key or storage is empty) */
  initialFavorites?: number[];
}

export interface UseFavoritesReturn {
  /** Set of favorited item IDs */
  favorites: Set<number>;
  /** Check if an item is favorited */
  isFavorited: (id: number) => boolean;
  /** Toggle favorite status for an item */
  toggleFavorite: (id: number) => void;
  /** Add an item to favorites */
  addFavorite: (id: number) => void;
  /** Remove an item from favorites */
  removeFavorite: (id: number) => void;
  /** Set all favorites at once */
  setFavorites: (ids: number[]) => void;
  /** Clear all favorites */
  clearFavorites: () => void;
  /** Number of favorited items */
  count: number;
}

/**
 * Hook for managing favorites with optional persistence
 *
 * @example
 * ```tsx
 * // Without persistence
 * const { favorites, toggleFavorite, isFavorited } = useFavorites();
 *
 * // With localStorage persistence
 * const { favorites, toggleFavorite, isFavorited } = useFavorites({
 *   storageKey: 'chart-favorites',
 * });
 *
 * // In a component
 * <Button onClick={() => toggleFavorite(chart.id)}>
 *   {isFavorited(chart.id) ? <StarFilled /> : <Star />}
 * </Button>
 * ```
 */
export function useFavorites(options: UseFavoritesOptions = {}): UseFavoritesReturn {
  const { storageKey, initialFavorites = [] } = options;

  // Initialize state from localStorage if available
  const [favorites, setFavoritesState] = useState<Set<number>>(() => {
    if (typeof window !== 'undefined' && storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return new Set(parsed);
          }
        }
      } catch (e) {
        console.warn(`Failed to load favorites from localStorage: ${storageKey}`, e);
      }
    }
    return new Set(initialFavorites);
  });

  // Persist to localStorage when favorites change
  useEffect(() => {
    if (typeof window !== 'undefined' && storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(favorites)));
      } catch (e) {
        console.warn(`Failed to save favorites to localStorage: ${storageKey}`, e);
      }
    }
  }, [favorites, storageKey]);

  const isFavorited = useCallback((id: number): boolean => favorites.has(id), [favorites]);

  const toggleFavorite = useCallback((id: number): void => {
    setFavoritesState((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(id)) {
        newFavorites.delete(id);
      } else {
        newFavorites.add(id);
      }
      return newFavorites;
    });
  }, []);

  const addFavorite = useCallback((id: number): void => {
    setFavoritesState((prev) => {
      if (prev.has(id)) return prev;
      const newFavorites = new Set(prev);
      newFavorites.add(id);
      return newFavorites;
    });
  }, []);

  const removeFavorite = useCallback((id: number): void => {
    setFavoritesState((prev) => {
      if (!prev.has(id)) return prev;
      const newFavorites = new Set(prev);
      newFavorites.delete(id);
      return newFavorites;
    });
  }, []);

  const setFavorites = useCallback((ids: number[]): void => {
    setFavoritesState(new Set(ids));
  }, []);

  const clearFavorites = useCallback((): void => {
    setFavoritesState(new Set());
  }, []);

  return {
    favorites,
    isFavorited,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    setFavorites,
    clearFavorites,
    count: favorites.size,
  };
}

export default useFavorites;
