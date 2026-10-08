import type { GeneralAccessState, ParentBlock } from '@/hooks/api/useAccess';

/** Highest mode among the shared dashboards containing this resource (public 2, internal 1, private 0); -1 when none. */
export function getMaxParentBlockRank(parentBlocks: ParentBlock[]): number {
  return parentBlocks.length > 0
    ? Math.max(
        ...parentBlocks.map((b) => (b.mode === 'public' ? 2 : b.mode === 'internal' ? 1 : 0))
      )
    : -1;
}

/** Line under "General access". */
export function getGeneralAccessDescription(
  generalAccess: Pick<GeneralAccessState, 'mode' | 'allow_public_sharing'>
): string | null {
  switch (generalAccess.mode) {
    case 'internal':
      return 'Users can access this resource based on their role permissions';
    case 'private':
      return 'Only direct shares can access this resource';
    case 'public':
      return generalAccess.allow_public_sharing
        ? 'Anyone on the internet with the link can access this resource'
        : 'Public sharing is turned off by your admin';
    default:
      return null;
  }
}
