import {
  getGeneralAccessDescription,
  getMaxParentBlockRank,
} from '@/components/share/logic/general-access';
import type { ParentBlock } from '@/hooks/api/useAccess';

const block = (mode: ParentBlock['mode']): ParentBlock => ({
  dashboard_id: 1,
  dashboard_title: 'Board',
  mode,
});

describe('general access', () => {
  it('getMaxParentBlockRank: -1 with no parents, else the highest of private 0 / internal 1 / public 2', () => {
    expect(getMaxParentBlockRank([])).toBe(-1);
    expect(getMaxParentBlockRank([block('private')])).toBe(0);
    expect(getMaxParentBlockRank([block('internal')])).toBe(1);
    expect(getMaxParentBlockRank([block('private'), block('public')])).toBe(2);
  });

  it('getGeneralAccessDescription per mode', () => {
    expect(getGeneralAccessDescription({ mode: 'internal', allow_public_sharing: true })).toBe(
      'Users can access this resource based on their role permissions'
    );
    expect(getGeneralAccessDescription({ mode: 'private', allow_public_sharing: true })).toBe(
      'Only direct shares can access this resource'
    );
    expect(getGeneralAccessDescription({ mode: 'public', allow_public_sharing: true })).toBe(
      'Anyone on the internet with the link can access this resource'
    );
    expect(getGeneralAccessDescription({ mode: 'public', allow_public_sharing: false })).toBe(
      'Public sharing is turned off by your admin'
    );
  });
});
