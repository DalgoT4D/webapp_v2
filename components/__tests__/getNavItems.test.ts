/**
 * getNavItems tests — the "Admin Portal" nav link is gated on isPlatformAdmin.
 *
 * The sidebar renders items with `.filter((item) => !item.hide)`, so asserting the
 * `hide` flag is the load-bearing check (mirrors the existing feature-flag pattern).
 */

import { getNavItems } from '@/components/main-layout';

// getNavItems takes an isFeatureFlagEnabled fn; no flags matter for this suite.
const noFlags = () => false;

const adminItem = (isPlatformAdmin?: boolean) =>
  getNavItems('/impact', false, noFlags, undefined, isPlatformAdmin).find(
    (item) => item.title === 'Admin Portal'
  );

describe('getNavItems - Admin Portal link', () => {
  it('hides the Admin Portal link when the user is not a platform admin', () => {
    const item = adminItem(false);
    expect(item).toBeDefined();
    expect(item?.hide).toBe(true);
  });

  it('shows the Admin Portal link when the user is a platform admin', () => {
    const item = adminItem(true);
    expect(item).toBeDefined();
    expect(item?.hide).toBe(false);
  });

  it('defaults to hidden when isPlatformAdmin is omitted', () => {
    expect(adminItem()?.hide).toBe(true);
  });
});
