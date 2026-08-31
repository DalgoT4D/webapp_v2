import { getRemoteCanvasSyncAction } from '../utils/remote-sync';

describe('getRemoteCanvasSyncAction', () => {
  it('opens the PAT modal only when the token is missing', () => {
    expect(getRemoteCanvasSyncAction(false, false)).toBe('open-pat-modal');
    expect(getRemoteCanvasSyncAction(false, true)).toBe('open-pat-modal');
  });

  it('waits for lock acquisition when a PAT already exists', () => {
    expect(getRemoteCanvasSyncAction(true, false)).toBe('wait-for-lock');
  });

  it('syncs only when both the PAT and canvas lock are available', () => {
    expect(getRemoteCanvasSyncAction(true, true)).toBe('sync');
  });
});
