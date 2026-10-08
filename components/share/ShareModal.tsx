'use client';

import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  useAccessRequests,
  useActiveMembers,
  useResourceGrantActions,
  useResourceGrants,
  useUserGroups,
} from '@/hooks/api/useAccess';
import { useRoles } from '@/hooks/api/useUserManagement';
import { useAuthStore } from '@/stores/authStore';
import { ADMIN_ROLES } from '@/lib/rbac';
import {
  buildActiveUserByEmail,
  sortSharesForDisplay,
} from '@/components/share/logic/share-grants';
import { useShareChips } from '@/components/share/hooks/useShareChips';
import { useShareRowActions } from '@/components/share/hooks/useShareRowActions';
import { useGeneralAccessChange } from '@/components/share/hooks/useGeneralAccessChange';
import { useLegacyEmailShare } from '@/components/share/hooks/useLegacyEmailShare';
import { AccessRequestsList } from '@/components/share/AccessRequestsList';
import { PeoplePicker } from '@/components/share/PeoplePicker';
import { AccessList } from '@/components/share/AccessList';
import { GeneralAccessSection } from '@/components/share/GeneralAccessSection';
import {
  AdminTakeoverDialog,
  CascadeConfirmDialog,
  TransferOwnershipDialog,
} from '@/components/share/ShareConfirmDialogs';
import { LegacyEmailShareSection } from '@/components/share/LegacyEmailShareSection';

interface ShareModalProps {
  /** The resource type identifier (e.g. "dashboard"). When provided, enables
   * the chip typeahead + "People with access" + "General access" sections. */
  rtype?: string;
  entityId: number;
  entityLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  /** Called only when the public link actually reached the user's clipboard.
   * This component stays analytics-free (it lives in components/share/), so callers
   * hang the "shared" event (and the onboarding walkthrough's final step) here. */
  onCopyLink?: () => void;
  /** Called after General access successfully flips to Public. Same reason as
   * onCopyLink: onboarding milestones belong to the caller, not to this component. */
  onMadePublic?: () => void;
  /** Legacy email section; rendered only when passed (no caller passes it today). */
  onShareViaEmail?: (data: {
    recipient_emails: string[];
    message?: string;
  }) => Promise<{ recipients_count: number; message: string }>;
}

export function ShareModal({
  rtype,
  entityId,
  entityLabel,
  isOpen,
  onClose,
  onUpdate,
  onCopyLink,
  onMadePublic,
  onShareViaEmail,
}: ShareModalProps) {
  const entityLabelLower = entityLabel.toLowerCase();

  // Data sources — only fetch when modal is open to avoid firing these APIs
  // on every page mount where a ShareModal is present.
  const { people } = useActiveMembers(isOpen);
  const { groups } = useUserGroups(isOpen);
  const { roles } = useRoles(isOpen);
  const getCurrentOrgUser = useAuthStore((state) => state.getCurrentOrgUser);
  const currentOrgUser = getCurrentOrgUser();
  const isAdmin = currentOrgUser
    ? ADMIN_ROLES.includes(currentOrgUser.new_role_slug as (typeof ADMIN_ROLES)[number])
    : false;

  const grants = useResourceGrants(
    isOpen && rtype ? rtype : null,
    isOpen && rtype ? entityId : null
  );
  const { shares, callerIsOwner, generalAccess, owner, mutate: mutateGrants } = grants;
  const isOwnerOrAdmin = callerIsOwner || isAdmin;
  const canAdminTakeover = isAdmin && !callerIsOwner && !!owner;

  const { requests, mutate: mutateRequests } = useAccessRequests(
    isOpen && rtype ? rtype : null,
    isOpen && rtype ? entityId : null
  );
  const grantActions = useResourceGrantActions(rtype ?? '', entityId);

  const memberRoleUuid = useMemo(() => roles?.find((r) => r.slug === 'member')?.uuid, [roles]);
  const sortedShares = useMemo(() => sortSharesForDisplay(shares), [shares]);
  const activeUserByEmail = useMemo(() => buildActiveUserByEmail(people), [people]);

  const staging = useShareChips({
    isOpen,
    people,
    groups,
    memberRoleUuid,
    shares,
    owner,
    activeUserByEmail,
    addGrants: grantActions.addGrants,
    mutateGrants,
    onUpdate,
    onClose,
  });
  const rowActions = useShareRowActions({
    rtype,
    entityId,
    grants,
    grantActions,
    onUpdate,
    currentOrgUserEmail: currentOrgUser?.email,
    activeUserByEmail,
  });
  const accessChange = useGeneralAccessChange({
    rtype,
    entityId,
    entityLabel,
    generalAccess,
    mutateGrants,
    onUpdate,
    onMadePublic,
    onCopyLink,
  });
  const legacyEmail = useLegacyEmailShare({ isOpen, entityLabel, onShareViaEmail });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        data-testid="share-modal"
        className="sm:max-w-xl max-h-[90vh] flex flex-col p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Share &quot;{entityLabel}&quot;</DialogTitle>
          {rtype === 'dashboard' && (
            <p className="text-sm text-muted-foreground mt-0.5">
              All inner charts and KPIs will inherit this permission.
            </p>
          )}
        </DialogHeader>

        <div className="space-y-5 flex-1 overflow-y-auto min-h-0 px-6 pb-4">
          {rtype && (requests ?? []).length > 0 && (
            <AccessRequestsList
              rtype={rtype}
              entityId={entityId}
              requests={requests ?? []}
              onRequestsChanged={() => mutateRequests()}
              onGrantsChanged={() => mutateGrants()}
            />
          )}

          {rtype && (
            <>
              <PeoplePicker
                staging={staging}
                isAdmin={isAdmin}
                roles={roles}
                activeUserByEmail={activeUserByEmail}
              />
              <AccessList
                owner={owner}
                canAdminTakeover={canAdminTakeover}
                onTakeoverClick={() => rowActions.setTakeoverConfirmOpen(true)}
                shares={shares}
                sortedShares={sortedShares}
                currentUserEmail={currentOrgUser?.email}
                rowBusyId={rowActions.rowBusyId}
                isOwnerOrAdmin={isOwnerOrAdmin}
                onLevelChange={rowActions.handleRowLevelChange}
                onTransfer={rowActions.setTransferTarget}
                onRemove={rowActions.handleRowRemove}
              />
            </>
          )}

          {/* General access — hidden for floor-only users (they can't change visibility) */}
          {rtype && generalAccess && !generalAccess.caller_access_via_floor && (
            <GeneralAccessSection
              generalAccess={generalAccess}
              modeChanging={accessChange.modeChanging}
              onModeChange={accessChange.handleModeChange}
              entityLabelLower={entityLabelLower}
              onCopyPublicUrl={accessChange.handleCopyPublicUrl}
            />
          )}

          {/* Cascade confirmation dialog (dashboard only) */}
          {rowActions.pendingAction && (
            <CascadeConfirmDialog
              onCancel={rowActions.cancelPendingAction}
              onConfirm={rowActions.handleCascadeConfirm}
            />
          )}

          {/* Ownership transfer confirmation dialog */}
          {rowActions.transferTarget && (
            <TransferOwnershipDialog
              targetLabel={rowActions.transferTarget.label}
              entityLabel={entityLabel}
              isTransferring={rowActions.isTransferring}
              onCancel={() => rowActions.setTransferTarget(null)}
              onConfirm={rowActions.handleTransferConfirm}
            />
          )}

          {/* Admin takeover confirmation dialog */}
          {rowActions.takeoverConfirmOpen && owner && (
            <AdminTakeoverDialog
              ownerEmail={owner.email}
              resourceNoun={rtype ?? entityLabelLower}
              isTakingOver={rowActions.isTakingOver}
              onCancel={() => rowActions.setTakeoverConfirmOpen(false)}
              onConfirm={rowActions.handleAdminTakeoverConfirm}
            />
          )}

          {/* Legacy email share (Reports) */}
          {onShareViaEmail && <LegacyEmailShareSection email={legacyEmail} />}
        </div>

        {/* Sticky footer — sits below the scrollable body so long chip lists
            never push the SHARE button off-screen. */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-background">
          <Button variant="outline" onClick={onClose} data-testid="share-close-btn">
            CANCEL
          </Button>
          <Button
            variant="primary"
            onClick={staging.handleShareClick}
            disabled={staging.isSubmitting || staging.chips.length === 0}
            data-testid="share-submit-btn"
          >
            {staging.isSubmitting ? 'SHARING…' : 'SHARE'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
