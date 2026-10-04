import { useState } from 'react';
import type { KeyedMutator } from 'swr';
import type { Chart, ChartListResponse } from '@/hooks/api/useCharts';
import { useFavoriteChart, useUnfavoriteChart } from '@/hooks/api/useChart';
import { toastError } from '@/lib/toast';

/**
 * Chart-list star. The star flips immediately and the list is not refetched on
 * success — the only thing that changed is a field we already know. On failure the
 * list is refetched (rolling the flip back) and a toast is shown.
 */
export function useChartFavoriteToggle(mutate: KeyedMutator<ChartListResponse>) {
  const { trigger: favoriteChart } = useFavoriteChart();
  const { trigger: unfavoriteChart } = useUnfavoriteChart();

  // Stars currently mid-request. isMutating on the hooks is keyed on '/api/charts/',
  // so it's shared by every row — this tracks it per chart instead.
  const [favoritingIds, setFavoritingIds] = useState<Set<number>>(new Set());

  const handleToggleFavorite = async (chart: Chart) => {
    if (favoritingIds.has(chart.id)) return;

    const wasFavorite = chart.is_favorite ?? false;
    setFavoritingIds((prev) => new Set(prev).add(chart.id));

    mutate(
      (current) =>
        current && {
          ...current,
          data: current.data.map((c) =>
            c.id === chart.id ? { ...c, is_favorite: !wasFavorite } : c
          ),
        },
      { revalidate: false }
    );

    try {
      if (wasFavorite) {
        await unfavoriteChart(chart.id);
      } else {
        await favoriteChart(chart.id);
      }
    } catch (error) {
      await mutate(); // roll the optimistic flip back to server truth
      toastError.update(error, 'favorite');
    } finally {
      setFavoritingIds((prev) => {
        const next = new Set(prev);
        next.delete(chart.id);
        return next;
      });
    }
  };

  return { favoritingIds, handleToggleFavorite };
}
