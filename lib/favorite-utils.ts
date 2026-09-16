import { toastError } from '@/lib/toast';

// Shared by the charts and dashboards list pages — both toggle a favorite the
// same way (call the matching mutation, refetch the list, toast on failure).
export async function toggleFavorite(
  isFavorited: boolean,
  id: number,
  favoriteFn: (id: number) => Promise<unknown>,
  unfavoriteFn: (id: number) => Promise<unknown>,
  mutate: () => Promise<unknown>
): Promise<void> {
  try {
    if (isFavorited) {
      await unfavoriteFn(id);
    } else {
      await favoriteFn(id);
    }
    await mutate();
  } catch (error) {
    toastError.update(error, 'favorite');
  }
}
