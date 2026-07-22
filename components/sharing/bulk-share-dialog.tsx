'use client';

/**
 * BulkShareDialog — the "Share" action on a list's bulk-selection bar. One
 * POST per action to /api/access/bulk/, apply-where-possible. Deliberately
 * separate from ShareModal: a bulk action has no single current state to
 * show, so every section is a one-shot action + result.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share2, Users, UsersRound, Shield, Globe, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  bulkApplyAccess,
  type BulkItemRef,
  type BulkAccessRequest,
  type BulkAccessResponse,
  type BulkAddGrantPayload,
  type BulkSetGeneralPayload,
  type BulkTogglePublicPayload,
  type ChartCoverageVerdict,
  type ShareableResourceType,
  type AccessLevel,
  type RolePermissionLevel,
} from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups } from '@/hooks/api/useUserGroups';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  ROLE_LEVEL_ORDER,
  ROLE_LEVEL_LABELS,
  LEVEL_LABELS,
  RESOURCE_NOUNS,
} from '@/lib/access-labels';
import { BroadeningConfirmDialog } from '@/components/sharing/broadening-confirm-dialog';
import {
  unionCoverageVerdicts,
  type CoverageDecision,
} from '@/components/sharing/coverage-confirm-utils';

// Plain-language mapping for the backend's stable skip-reason codes. Kept
// here (not in useResourceAccess.ts) since it's presentation, not contract.
export const SKIP_REASON_COPY: Record<string, string> = {
  not_found: "This item couldn't be found.",
  share_permission_denied: "You don't have permission to share this.",
  edit_access_denied: "You can't edit this one.",
  grants_not_supported: "Adding people isn't available for this type.",
  general_access_not_supported: "General access isn't available for this type.",
  public_link_not_supported: "Public links aren't available for this type.",
  public_sharing_disabled: 'Public links are turned off for your organization.',
  principal_not_found: "That person or group isn't in your organization.",
  validation_error: "This change isn't allowed for one or more items.",
  member_grants_deferred: "Members can't be added to this type directly yet.",
};
const DEFAULT_SKIP_REASON_COPY = "This one couldn't be updated.";

/** Groups skipped items by reason and counts them, for a compact result list. */
function groupSkipReasons(skipped: BulkAccessResponse['skipped']): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of skipped) {
    counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
  }
  return [...counts.entries()];
}

function summaryText(response: BulkAccessResponse, total: number): string {
  const skippedPart = response.skipped_count > 0 ? ` ${response.skipped_count} skipped.` : '';
  return `Shared ${response.applied_count} of ${total}.${skippedPart}`;
}

function showSummaryToast(response: BulkAccessResponse, total: number) {
  const text = summaryText(response, total);
  if (response.skipped_count === 0) toastSuccess.generic(text);
  else if (response.applied_count === 0) toastError.api(text);
  else toastInfo.generic(text);
}

interface BulkShareDialogProps {
  entityType: ShareableResourceType;
  /** Plural, lowercase — used in copy ("2 dashboards selected"). */
  entityLabel: string;
  items: BulkItemRef[];
  isOpen: boolean;
  onClose: () => void;
  /** Called after every resolved POST (including the intermediate
   * requires_confirmation response) — the caller deselects `applied` ids
   * and revalidates the list; skipped/pending-confirmation ids stay selected. */
  onApplied: (response: BulkAccessResponse) => void;
  /** False for alerts — public_link=False rtype, no dead control shown. */
  allowPublicLink: boolean;
}

export function BulkShareDialog({
  entityType,
  entityLabel,
  items,
  isOpen,
  onClose,
  onApplied,
  allowPublicLink,
}: BulkShareDialogProps) {
  const { users: orgUsers } = useUsers();
  const { data: groups } = useUserGroups();

  // Snapshot `items` when the dialog opens, not the live prop: onApplied
  // deselects applied ids immediately, shrinking the live prop, so a second
  // action would silently narrow (or 400 on an empty list) without this.
  const [snapshotItems, setSnapshotItems] = useState<BulkItemRef[]>(items);
  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSnapshotItems(items);
    }
    wasOpenRef.current = isOpen;
    // Deliberately excludes `items` — only a closed->open transition re-snapshots.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [personPermission, setPersonPermission] = useState<AccessLevel>('view');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupPermission, setGroupPermission] = useState<AccessLevel>('view');
  // Per-role general-access levels: Analysts and Members are each
  // independently "none"/"view"/"edit".
  const [analystLevel, setAnalystLevel] = useState<RolePermissionLevel>('none');
  const [memberLevel, setMemberLevel] = useState<RolePermissionLevel>('none');

  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<BulkAccessResponse | null>(null);
  const [confirmState, setConfirmState] = useState<{
    analystLevel: RolePermissionLevel;
    memberLevel: RolePermissionLevel;
    confirmationItems: BulkAccessResponse['requires_confirmation'];
  } | null>(null);

  // Dashboard-broadening confirmations: held items with their charts named,
  // one aggregated prompt for the whole selection. `resend` snapshots the
  // action payload so YES re-sends exactly what was asked to just the held items.
  type BroadeningResend =
    | { action: 'add_grant'; add_grant: BulkAddGrantPayload }
    | { action: 'set_general'; set_general: BulkSetGeneralPayload }
    | { action: 'toggle_public'; toggle_public: BulkTogglePublicPayload };
  const [broadening, setBroadening] = useState<{
    items: BulkItemRef[];
    verdicts: ChartCoverageVerdict[];
    resend: BroadeningResend;
  } | null>(null);

  const captureBroadening = useCallback(
    (response: BulkAccessResponse, resend: BroadeningResend) => {
      // Pure-broadening items only — items with persisting_grants belong to
      // the narrowing keep/remove panel; a mixed narrow+widen request
      // resolves sequentially.
      const held = response.requires_confirmation.filter(
        (item) =>
          (item.under_covering_charts?.length ?? 0) > 0 &&
          (item.persisting_grants?.length ?? 0) === 0
      );
      if (held.length === 0) return;
      setBroadening({
        items: held.map(({ rtype, id }) => ({ rtype, id })),
        verdicts: unionCoverageVerdicts(held.map((item) => item.under_covering_charts ?? [])),
        resend,
      });
    },
    []
  );

  const personItems: ComboboxItem[] = useMemo(
    () => (orgUsers || []).map((u) => ({ value: String(u.orguser_id), label: u.email })),
    [orgUsers]
  );
  const groupItems: ComboboxItem[] = useMemo(
    () => (groups || []).map((g) => ({ value: String(g.id), label: g.name })),
    [groups]
  );

  // Always notify the caller so committed items revalidate/deselect right
  // away; only toast + fire analytics once no confirmation is pending.
  const handleResponse = useCallback(
    (response: BulkAccessResponse, action: 'add_grant' | 'set_general' | 'toggle_public') => {
      setResult(response);
      onApplied(response);
      if (response.requires_confirmation.length === 0) {
        setConfirmState(null);
        showSummaryToast(response, snapshotItems.length);
        trackEvent(ANALYTICS_EVENTS.SHARING_BULK_APPLIED, {
          entity_type: entityType,
          action,
          selected_count: snapshotItems.length,
          applied_count: response.applied_count,
          skipped_count: response.skipped_count,
        });
      }
    },
    [entityType, snapshotItems.length, onApplied]
  );

  const handleAddPerson = useCallback(async () => {
    if (!selectedPersonId || snapshotItems.length === 0) return;
    setIsApplying(true);
    try {
      const payload: BulkAddGrantPayload = {
        principal_type: 'user',
        principal_id: Number(selectedPersonId),
        permission: personPermission,
      };
      const response = await bulkApplyAccess({
        items: snapshotItems,
        action: 'add_grant',
        add_grant: payload,
      });
      captureBroadening(response, { action: 'add_grant', add_grant: payload });
      handleResponse(response, 'add_grant');
      setSelectedPersonId('');
    } catch (error) {
      toastError.api(error, 'share with this person');
    } finally {
      setIsApplying(false);
    }
  }, [snapshotItems, selectedPersonId, personPermission, captureBroadening, handleResponse]);

  const handleAddGroup = useCallback(async () => {
    if (!selectedGroupId || snapshotItems.length === 0) return;
    setIsApplying(true);
    try {
      const payload: BulkAddGrantPayload = {
        principal_type: 'group',
        principal_id: Number(selectedGroupId),
        permission: groupPermission,
      };
      const response = await bulkApplyAccess({
        items: snapshotItems,
        action: 'add_grant',
        add_grant: payload,
      });
      captureBroadening(response, { action: 'add_grant', add_grant: payload });
      handleResponse(response, 'add_grant');
      setSelectedGroupId('');
    } catch (error) {
      toastError.api(error, 'share with this group');
    } finally {
      setIsApplying(false);
    }
  }, [snapshotItems, selectedGroupId, groupPermission, captureBroadening, handleResponse]);

  const applyGeneralAccess = useCallback(
    async (removeGrantIds?: number[]) => {
      if (snapshotItems.length === 0) return;
      setIsApplying(true);
      try {
        const payload: BulkSetGeneralPayload = {
          analyst_level: analystLevel,
          member_level: memberLevel,
          ...(removeGrantIds !== undefined ? { remove_grant_ids: removeGrantIds } : {}),
        };
        const response = await bulkApplyAccess({
          items: snapshotItems,
          action: 'set_general',
          set_general: payload,
        });
        // Narrowing half (persisting grants) → keep/remove panel;
        // pure-broadening items → the aggregated confirm dialog. Mixed
        // requests resolve sequentially across round trips.
        const narrowingItems = response.requires_confirmation.filter(
          (item) => (item.persisting_grants?.length ?? 0) > 0
        );
        if (narrowingItems.length > 0) {
          setConfirmState({
            analystLevel,
            memberLevel,
            confirmationItems: narrowingItems,
          });
        }
        captureBroadening(response, { action: 'set_general', set_general: payload });
        handleResponse(response, 'set_general');
      } catch (error) {
        toastError.api(error, 'update general access');
      } finally {
        setIsApplying(false);
      }
    },
    [snapshotItems, analystLevel, memberLevel, captureBroadening, handleResponse]
  );

  const handleApplyGeneral = useCallback(() => applyGeneralAccess(undefined), [applyGeneralAccess]);

  const persistingGrants = useMemo(
    () => (confirmState ? confirmState.confirmationItems.flatMap((c) => c.persisting_grants) : []),
    [confirmState]
  );

  const handleKeepAccess = useCallback(() => applyGeneralAccess([]), [applyGeneralAccess]);
  const handleRemoveAccessToo = useCallback(
    () => applyGeneralAccess(persistingGrants.map((g) => g.id)),
    [applyGeneralAccess, persistingGrants]
  );

  const handleTogglePublic = useCallback(
    async (isPublic: boolean) => {
      if (snapshotItems.length === 0) return;
      setIsApplying(true);
      try {
        const response = await bulkApplyAccess({
          items: snapshotItems,
          action: 'toggle_public',
          toggle_public: { is_public: isPublic },
        });
        captureBroadening(response, {
          action: 'toggle_public',
          toggle_public: { is_public: isPublic },
        });
        handleResponse(response, 'toggle_public');
      } catch (error) {
        toastError.api(error, 'update the public link');
      } finally {
        setIsApplying(false);
      }
    },
    [snapshotItems, captureBroadening, handleResponse]
  );

  // YES: re-send the same action to just the held items, plus the confirm
  // fields. toggle_public only adds `proceed` — public exposure is never extendable.
  const handleBroadeningConfirm = useCallback(
    async (decision: CoverageDecision) => {
      if (!broadening) return;
      setIsApplying(true);
      try {
        const confirmFields = {
          ...(decision.extendChartIds.length > 0
            ? { extend_chart_ids: decision.extendChartIds }
            : {}),
          proceed: true,
        };
        const { resend, items } = broadening;
        const request: BulkAccessRequest =
          resend.action === 'add_grant'
            ? { items, action: 'add_grant', add_grant: { ...resend.add_grant, ...confirmFields } }
            : resend.action === 'set_general'
              ? {
                  items,
                  action: 'set_general',
                  set_general: { ...resend.set_general, ...confirmFields },
                }
              : {
                  items,
                  action: 'toggle_public',
                  toggle_public: { ...resend.toggle_public, proceed: true },
                };
        const response = await bulkApplyAccess(request);
        setBroadening(null);
        handleResponse(response, resend.action);
      } catch (error) {
        toastError.api(error, 'apply this change');
      } finally {
        setIsApplying(false);
      }
    },
    [broadening, handleResponse]
  );

  // CANCEL: nothing was written for the held items; they stay selected.
  const handleBroadeningCancel = useCallback(() => setBroadening(null), []);

  const skipReasonGroups = result ? groupSkipReasons(result.skipped) : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent data-testid="bulk-share-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share {snapshotItems.length} {entityLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add a person or group */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <Label className="text-sm font-medium">Add a person</Label>
              </div>
              <div className="flex gap-2">
                <Combobox
                  id="bulk-share-person-combobox"
                  items={personItems}
                  value={selectedPersonId}
                  onValueChange={setSelectedPersonId}
                  placeholder="Select an org member"
                  searchPlaceholder="Search by email"
                  className="flex-1"
                />
                <Select
                  value={personPermission}
                  onValueChange={(value) => setPersonPermission(value as AccessLevel)}
                >
                  <SelectTrigger
                    data-testid="bulk-share-person-permission"
                    size="sm"
                    className="w-24"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">{LEVEL_LABELS.view}</SelectItem>
                    <SelectItem value="edit">{LEVEL_LABELS.edit}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  data-testid="bulk-share-add-person-btn"
                  onClick={handleAddPerson}
                  disabled={!selectedPersonId || isApplying || snapshotItems.length === 0}
                >
                  Share
                </Button>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <UsersRound className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs font-medium">Add a group</Label>
              </div>
              <div className="flex gap-2">
                <Combobox
                  id="bulk-share-group-combobox"
                  items={groupItems}
                  value={selectedGroupId}
                  onValueChange={setSelectedGroupId}
                  placeholder="Select a group"
                  searchPlaceholder="Search groups"
                  className="flex-1"
                />
                <Select
                  value={groupPermission}
                  onValueChange={(value) => setGroupPermission(value as AccessLevel)}
                >
                  <SelectTrigger
                    data-testid="bulk-share-group-permission"
                    size="sm"
                    className="w-24"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">{LEVEL_LABELS.view}</SelectItem>
                    <SelectItem value="edit">{LEVEL_LABELS.edit}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  data-testid="bulk-share-add-group-btn"
                  onClick={handleAddGroup}
                  disabled={!selectedGroupId || isApplying || snapshotItems.length === 0}
                >
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* General access */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-blue-600" />
                <Label className="text-sm font-medium">Set general access</Label>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="bulk-share-general-analyst-level" className="text-sm">
                    Analysts
                  </Label>
                  <Select
                    value={analystLevel}
                    onValueChange={(value) => setAnalystLevel(value as RolePermissionLevel)}
                  >
                    <SelectTrigger
                      id="bulk-share-general-analyst-level"
                      data-testid="bulk-share-general-analyst-level"
                      className="w-40"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_LEVEL_ORDER.map((lvl) => (
                        <SelectItem key={lvl} value={lvl}>
                          {ROLE_LEVEL_LABELS[lvl]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="bulk-share-general-member-level" className="text-sm">
                    Members
                  </Label>
                  <Select
                    value={memberLevel}
                    onValueChange={(value) => setMemberLevel(value as RolePermissionLevel)}
                  >
                    <SelectTrigger
                      id="bulk-share-general-member-level"
                      data-testid="bulk-share-general-member-level"
                      className="w-40"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_LEVEL_ORDER.map((lvl) => (
                        <SelectItem key={lvl} value={lvl}>
                          {ROLE_LEVEL_LABELS[lvl]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                data-testid="bulk-share-general-apply-btn"
                variant="outline"
                onClick={handleApplyGeneral}
                disabled={isApplying || snapshotItems.length === 0}
              >
                {isApplying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Apply
              </Button>

              {confirmState && (
                <div
                  data-testid="bulk-share-confirm-panel"
                  className="space-y-3 p-3 bg-orange-50 border border-orange-200 rounded-md"
                >
                  <p className="text-xs text-orange-800">
                    {persistingGrants.length} people still have individual access to some of these{' '}
                    {entityLabel}. Keep their access, or remove it along with this change?
                  </p>
                  <ul className="text-xs text-orange-800 list-disc list-inside">
                    {persistingGrants.map((g) => (
                      <li key={g.id}>{g.name || g.email}</li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Button
                      data-testid="bulk-share-confirm-keep-btn"
                      size="sm"
                      variant="outline"
                      onClick={handleKeepAccess}
                      disabled={isApplying}
                    >
                      Keep their access
                    </Button>
                    <Button
                      data-testid="bulk-share-confirm-remove-btn"
                      size="sm"
                      variant="outline"
                      onClick={handleRemoveAccessToo}
                      disabled={isApplying}
                    >
                      Remove their access too
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Public link — dashboards/reports only (public_link=False for alerts) */}
          {allowPublicLink && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-green-600" />
                  <Label className="text-sm font-medium">Public link</Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    data-testid="bulk-share-public-on-btn"
                    variant="outline"
                    disabled={isApplying || snapshotItems.length === 0}
                    onClick={() => handleTogglePublic(true)}
                  >
                    Turn on
                  </Button>
                  <Button
                    data-testid="bulk-share-public-off-btn"
                    variant="outline"
                    disabled={isApplying || snapshotItems.length === 0}
                    onClick={() => handleTogglePublic(false)}
                  >
                    Turn off
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Result — counts + plain-language skip reasons */}
          {result && (
            <div data-testid="bulk-share-result" className="text-sm space-y-2">
              <p>{summaryText(result, snapshotItems.length)}</p>
              {result.skipped.length > 0 && (
                <ul
                  data-testid="bulk-share-skip-reasons"
                  className="text-xs text-muted-foreground list-disc list-inside"
                >
                  {skipReasonGroups.map(([reason, count]) => (
                    <li key={reason}>
                      {count} × {SKIP_REASON_COPY[reason] ?? DEFAULT_SKIP_REASON_COPY}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button data-testid="bulk-share-close-btn" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* One aggregated broadening prompt for the whole selection —
            no per-chart or per-item picker. */}
        {broadening && broadening.verdicts.length > 0 && (
          <BroadeningConfirmDialog
            open
            resourceName={
              broadening.items.length === 1
                ? RESOURCE_NOUNS[broadening.items[0].rtype]
                : `${broadening.items.length} ${entityLabel}`
            }
            verdicts={broadening.verdicts}
            containerNoun="selection"
            isSubmitting={isApplying}
            onCancel={handleBroadeningCancel}
            onConfirm={handleBroadeningConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
