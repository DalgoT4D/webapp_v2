export type RemoteCanvasSyncAction = 'open-pat-modal' | 'wait-for-lock' | 'sync';

/** Keep PAT state and canvas-lock state independent during editor startup. */
export function getRemoteCanvasSyncAction(
  hasToken: boolean,
  hasLock: boolean
): RemoteCanvasSyncAction {
  if (!hasToken) return 'open-pat-modal';
  return hasLock ? 'sync' : 'wait-for-lock';
}
