import {
  buildActiveUserByEmail,
  buildAddGrantsPayload,
  buildCurrentPrincipalKeys,
  buildShareSuggestions,
  canOfferTransfer,
  cascadeBlockMessage,
  describePendingEmails,
  getShareRowKey,
  isCascadeDowngrade,
  isOwnShare,
  isShareRowBusy,
  sortSharesForDisplay,
  type StagedChip,
} from '@/components/share/logic/share-grants';
import type { ShareRow } from '@/types/access';
import type { PersonRow } from '@/types/user-management';
import type { GroupListRow } from '@/types/user-groups';

const share = (overrides: Partial<ShareRow> = {}): ShareRow => ({
  share_id: 1,
  principal_type: 'user',
  principal_id: 10,
  email: 'a@ngo.org',
  label: 'a@ngo.org',
  role_or_group: 'Member',
  access_level: 'view',
  status: 'active',
  cascade_sources: [],
  ...overrides,
});

const person = (overrides: Partial<PersonRow> = {}): PersonRow => ({
  email: 'p@ngo.org',
  role_slug: 'member',
  role_name: 'Member',
  status: 'active',
  created_by_email: null,
  orguser_id: 1,
  invitation_id: null,
  created_at: null,
  ...overrides,
});

const group = (id: number, name: string): GroupListRow => ({
  id,
  name,
  member_count: 1,
  created_by_email: null,
  created_at: '2026-01-01',
});

const chip = (overrides: Partial<StagedChip>): StagedChip => ({
  key: 'user:1',
  label: 'p@ngo.org',
  kind: 'user',
  principal_type: 'user',
  principal_id: 1,
  email: null,
  access_level: 'view',
  ...overrides,
});

describe('existing shares', () => {
  it('buildCurrentPrincipalKeys: user/group ids and lower-cased emails', () => {
    const keys = buildCurrentPrincipalKeys([
      share({ principal_type: 'user', principal_id: 10, email: 'A@NGO.org' }),
      share({ principal_type: 'group', principal_id: 4, email: null }),
      share({ principal_type: 'invitation', principal_id: null, email: 'x@ngo.org' }),
    ]);
    expect([...keys].sort()).toEqual(['email:a@ngo.org', 'email:x@ngo.org', 'group:4', 'user:10']);
    expect(buildCurrentPrincipalKeys(undefined).size).toBe(0);
  });

  it('sortSharesForDisplay: groups, then users, then pending invites — stable within each', () => {
    const u1 = share({ share_id: 1 });
    const pending = share({ share_id: 2, status: 'pending', principal_type: 'invitation' });
    const g = share({ share_id: 3, principal_type: 'group' });
    const u2 = share({ share_id: 4 });
    expect(sortSharesForDisplay([u1, pending, g, u2]).map((s) => s.share_id)).toEqual([3, 1, 4, 2]);
    expect(sortSharesForDisplay(undefined)).toEqual([]);
  });

  it('getShareRowKey: share id, or inherited-<type>-<id> for cascade rows', () => {
    expect(getShareRowKey(share({ share_id: 7 }))).toBe('7');
    expect(getShareRowKey(share({ share_id: null, principal_id: 10 }))).toBe('inherited-user-10');
  });

  it('cascadeBlockMessage names the source dashboards', () => {
    expect(
      cascadeBlockMessage(
        share({
          cascade_sources: [
            { dashboard_id: 1, dashboard_title: 'Board' },
            { dashboard_id: 2, dashboard_title: 'Field' },
          ],
        })
      )
    ).toBe(
      'Access on this resource is inherited from: Board, Field — change permissions from there'
    );
    expect(cascadeBlockMessage(share({ cascade_sources: [] }))).toBe(
      'Access on this resource is inherited from: a dashboard — change permissions from there'
    );
  });

  it('isCascadeDowngrade: only cascade rows, only same-or-lower levels', () => {
    const inheritedView = share({ share_id: null, access_level: 'view' });
    expect(isCascadeDowngrade(inheritedView, 'view')).toBe(true);
    expect(isCascadeDowngrade(inheritedView, 'edit')).toBe(false);
    expect(isCascadeDowngrade(share({ share_id: null, access_level: 'edit' }), 'edit')).toBe(true);
    expect(isCascadeDowngrade(share({ share_id: 5, access_level: 'edit' }), 'view')).toBe(false);
  });

  it('isOwnShare: user rows whose email matches, case-insensitive', () => {
    expect(isOwnShare(share({ email: 'ME@ngo.org' }), 'me@NGO.org')).toBe(true);
    expect(isOwnShare(share({ principal_type: 'group', email: 'me@ngo.org' }), 'me@ngo.org')).toBe(
      false
    );
    expect(isOwnShare(share({ email: null }), 'me@ngo.org')).toBe(false);
    expect(isOwnShare(share({ email: 'me@ngo.org' }), undefined)).toBe(false);
  });

  it('canOfferTransfer: owners/admins, user rows with an id and Edit', () => {
    expect(canOfferTransfer(share({ access_level: 'edit' }), true)).toBe(true);
    expect(canOfferTransfer(share({ access_level: 'edit' }), false)).toBe(false);
    expect(canOfferTransfer(share({ access_level: 'view' }), true)).toBe(false);
    expect(canOfferTransfer(share({ access_level: 'edit', principal_type: 'group' }), true)).toBe(
      false
    );
  });

  it('isShareRowBusy: the row itself, or a cascade row by its principal id', () => {
    expect(isShareRowBusy(share({ share_id: 5 }), null)).toBe(false);
    expect(isShareRowBusy(share({ share_id: 5 }), 5)).toBe(true);
    expect(isShareRowBusy(share({ share_id: null, principal_id: 10 }), 10)).toBe(true);
    expect(isShareRowBusy(share({ share_id: 5, principal_id: 10 }), 10)).toBe(false);
  });
});

describe('people picker', () => {
  it('buildActiveUserByEmail: active members with an orguser id, keyed by lower-cased email', () => {
    const map = buildActiveUserByEmail([
      person({ email: 'Ana@ngo.org', orguser_id: 3, role_name: 'Analyst' }),
      person({ email: 'pending@ngo.org', status: 'pending', orguser_id: 4 }),
      person({ email: 'noid@ngo.org', orguser_id: null }),
    ]);
    expect([...map.entries()]).toEqual([['ana@ngo.org', { orguser_id: 3, role_name: 'Analyst' }]]);
  });

  it('buildShareSuggestions: owner and existing shares disabled with a reason; chipped excluded; groups last', () => {
    const suggestions = buildShareSuggestions({
      query: ' NGO ',
      people: [
        person({ email: 'owner@ngo.org', orguser_id: 1, role_name: 'Admin' }),
        person({ email: 'shared@ngo.org', orguser_id: 2 }),
        person({ email: 'chipped@ngo.org', orguser_id: 3 }),
        person({ email: 'free@ngo.org', orguser_id: 4 }),
        person({ email: 'other@elsewhere.org', orguser_id: 5 }),
      ],
      groups: [group(9, 'NGO staff'), group(8, 'Donors')],
      chippedKeys: new Set(['user:3']),
      currentPrincipals: new Set(['user:2']),
      owner: { orguser_id: 1, email: 'owner@ngo.org' },
    });
    expect(suggestions).toEqual([
      {
        kind: 'user',
        id: 1,
        label: 'owner@ngo.org',
        badge: 'Owner',
        disabled: true,
        disabledReason: 'Already the owner — has full access',
      },
      {
        kind: 'user',
        id: 2,
        label: 'shared@ngo.org',
        badge: 'Member',
        disabled: true,
        disabledReason: 'Already has access',
      },
      {
        kind: 'user',
        id: 4,
        label: 'free@ngo.org',
        badge: 'Member',
        disabled: false,
        disabledReason: undefined,
      },
      {
        kind: 'group',
        id: 9,
        label: 'NGO staff',
        badge: 'Group',
        disabled: false,
        disabledReason: undefined,
      },
    ]);
  });

  it('buildShareSuggestions: empty query lists everyone eligible, capped at 6 people and 4 groups', () => {
    const suggestions = buildShareSuggestions({
      query: '',
      people: Array.from({ length: 8 }, (_, i) =>
        person({ email: `p${i}@ngo.org`, orguser_id: i + 10 })
      ),
      groups: Array.from({ length: 6 }, (_, i) => group(i + 1, `G${i}`)),
      chippedKeys: new Set(),
      currentPrincipals: new Set(),
      owner: null,
    });
    expect(suggestions.filter((s) => s.kind === 'user')).toHaveLength(6);
    expect(suggestions.filter((s) => s.kind === 'group')).toHaveLength(4);
  });

  it('buildAddGrantsPayload: principals, pending emails, invite role only with emails', () => {
    const userChip = chip({});
    const groupChip = chip({
      key: 'group:4',
      kind: 'group',
      principal_type: 'group',
      principal_id: 4,
      access_level: 'edit',
    });
    const emailChip = chip({
      key: 'email:n@x.org',
      kind: 'email',
      principal_type: null,
      principal_id: null,
      email: 'n@x.org',
    });
    expect(buildAddGrantsPayload([userChip, groupChip, emailChip], 'role-member')).toEqual({
      principals: [
        { principal_type: 'user', principal_id: 1, access_level: 'view' },
        { principal_type: 'group', principal_id: 4, access_level: 'edit' },
      ],
      pending_grants: [{ email: 'n@x.org', access_level: 'view' }],
      invite_role_uuid: 'role-member',
    });
    expect(buildAddGrantsPayload([userChip], 'role-member').invite_role_uuid).toBeNull();
  });

  it('describePendingEmails: singular names the email, plural counts', () => {
    const one = chip({ key: 'email:n@x.org', kind: 'email', email: 'n@x.org' });
    const two = chip({ key: 'email:m@x.org', kind: 'email', email: 'm@x.org' });
    expect(describePendingEmails([chip({}), one])).toBe("n@x.org isn't on Dalgo yet.");
    expect(describePendingEmails([one, two])).toBe("2 emails aren't on Dalgo yet.");
  });
});
