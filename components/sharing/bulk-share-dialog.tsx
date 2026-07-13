'use client';

/**
 * BulkShareDialog — the "Share" action opened from a list's bulk-selection
 * bar (Dashboards/Reports/Alerts, task-17f). One POST per action to
 * /api/access/bulk/ — apply-where-possible, never all-or-nothing (see
 * task-17-report.md for the verbatim backend contract).
 *
 * Deliberately its own component rather than folded into ShareModal: a bulk
 * action has no single "current state" to show (each selected resource can
 * already differ), so every section here is a one-shot action + result,
 * not a live-editing view of one resource's grants.
 */
import { useCallback, useMemo, useState } from 'react';
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
  type BulkAccessResponse,
  type ShareableResourceType,
  type AccessAudience,
  type AccessLevel,
} from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups } from '@/hooks/api/useUserGroups';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

const AUDIENCE_ORDER: AccessAudience[] = ['private', 'admins', 'analysts_plus', 'all_users'];

const AUDIENCE_LABELS: Record<AccessAudience, string> = {
  private: 'Restricted (only people with access)',
  admins: 'Admins only',
  analysts_plus: 'Analysts and up',
  all_users: 'Everyone in your organization',
};

const LEVEL_LABELS: Record<AccessLevel, string> = {
  view: 'Viewer',
  edit: 'Editor',
};

// Plain-language mapping for the stable machine reason codes from
// ddpui/core/sharing/sharing_actions.py (see task-17-report.md's table).
// Kept here (not in useResourceAccess.ts) since it's presentation, not contract.
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

  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [personPermission, setPersonPermission] = useState<AccessLevel>('view');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupPermission, setGroupPermission] = useState<AccessLevel>('view');
  const [audience, setAudience] = useState<AccessAudience>('private');
  const [level, setLevel] = useState<AccessLevel>('view');

  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<BulkAccessResponse | null>(null);
  const [confirmState, setConfirmState] = useState<{
    audience: AccessAudience;
    level: AccessLevel;
    confirmationItems: BulkAccessResponse['requires_confirmation'];
  } | null>(null);

  const personItems: ComboboxItem[] = useMemo(
    () => (orgUsers || []).map((u) => ({ value: String(u.orguser_id), label: u.email })),
    [orgUsers]
  );
  const groupItems: ComboboxItem[] = useMemo(
    () => (groups || []).map((g) => ({ value: String(g.id), label: g.name })),
    [groups]
  );

  // Handles a resolved bulk response uniformly across all three actions:
  // always notify the caller (so already-committed items revalidate/deselect
  // right away); only toast + fire analytics once the round-trip is CLOSED —
  // i.e. this specific response carries no pending confirmation.
  const handleResponse = useCallback(
    (response: BulkAccessResponse, action: 'add_grant' | 'set_general' | 'toggle_public') => {
      setResult(response);
      onApplied(response);
      if (response.requires_confirmation.length === 0) {
        setConfirmState(null);
        showSummaryToast(response, items.length);
        trackEvent(ANALYTICS_EVENTS.SHARING_BULK_APPLIED, {
          entity_type: entityType,
          action,
          selected_count: items.length,
          applied_count: response.applied_count,
          skipped_count: response.skipped_count,
        });
      }
    },
    [entityType, items.length, onApplied]
  );

  const handleAddPerson = useCallback(async () => {
    if (!selectedPersonId) return;
    setIsApplying(true);
    try {
      const response = await bulkApplyAccess({
        items,
        action: 'add_grant',
        add_grant: {
          principal_type: 'user',
          principal_id: Number(selectedPersonId),
          permission: personPermission,
        },
      });
      handleResponse(response, 'add_grant');
      setSelectedPersonId('');
    } catch (error) {
      toastError.api(error, 'share with this person');
    } finally {
      setIsApplying(false);
    }
  }, [items, selectedPersonId, personPermission, handleResponse]);

  const handleAddGroup = useCallback(async () => {
    if (!selectedGroupId) return;
    setIsApplying(true);
    try {
      const response = await bulkApplyAccess({
        items,
        action: 'add_grant',
        add_grant: {
          principal_type: 'group',
          principal_id: Number(selectedGroupId),
          permission: groupPermission,
        },
      });
      handleResponse(response, 'add_grant');
      setSelectedGroupId('');
    } catch (error) {
      toastError.api(error, 'share with this group');
    } finally {
      setIsApplying(false);
    }
  }, [items, selectedGroupId, groupPermission, handleResponse]);

  const applyGeneralAccess = useCallback(
    async (removeGrantIds?: number[]) => {
      setIsApplying(true);
      try {
        const response = await bulkApplyAccess({
          items,
          action: 'set_general',
          set_general: {
            audience,
            level,
            ...(removeGrantIds !== undefined ? { remove_grant_ids: removeGrantIds } : {}),
          },
        });
        if (response.requires_confirmation.length > 0) {
          setConfirmState({ audience, level, confirmationItems: response.requires_confirmation });
        }
        handleResponse(response, 'set_general');
      } catch (error) {
        toastError.api(error, 'update general access');
      } finally {
        setIsApplying(false);
      }
    },
    [items, audience, level, handleResponse]
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
      setIsApplying(true);
      try {
        const response = await bulkApplyAccess({
          items,
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
    [items, handleResponse]
  );

  const skipReasonGroups = result ? groupSkipReasons(result.skipped) : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent data-testid="bulk-share-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share {items.length} {entityLabel}
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
                  disabled={!selectedPersonId || isApplying}
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
                  disabled={!selectedGroupId || isApplying}
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
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="bulk-share-general-audience" className="text-xs">
                    Who has access
                  </Label>
                  <Select
                    value={audience}
                    onValueChange={(value) => setAudience(value as AccessAudience)}
                  >
                    <SelectTrigger
                      id="bulk-share-general-audience"
                      data-testid="bulk-share-general-audience"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCE_ORDER.map((a) => (
                        <SelectItem key={a} value={a}>
                          {AUDIENCE_LABELS[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28 space-y-1">
                  <Label htmlFor="bulk-share-general-level" className="text-xs">
                    Permission
                  </Label>
                  <Select value={level} onValueChange={(value) => setLevel(value as AccessLevel)}>
                    <SelectTrigger
                      id="bulk-share-general-level"
                      data-testid="bulk-share-general-level"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">{LEVEL_LABELS.view}</SelectItem>
                      <SelectItem value="edit">{LEVEL_LABELS.edit}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                data-testid="bulk-share-general-apply-btn"
                variant="outline"
                onClick={handleApplyGeneral}
                disabled={isApplying}
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
                    disabled={isApplying}
                    onClick={() => handleTogglePublic(true)}
                  >
                    Turn on
                  </Button>
                  <Button
                    data-testid="bulk-share-public-off-btn"
                    variant="outline"
                    disabled={isApplying}
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
              <p>{summaryText(result, items.length)}</p>
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
      </DialogContent>
    </Dialog>
  );
}
