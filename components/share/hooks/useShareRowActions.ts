import { useState } from 'react';
import { toastSuccess, toastError } from '@/lib/toast';
import {
  transferOwnership,
  type useResourceGrantActions,
  type useResourceGrants,
} from '@/hooks/api/useAccess';
import type { AccessLevel, ShareRow } from '@/types/access';
import {
  cascadeBlockMessage,
  isCascadeDowngrade,
  type ActiveUser,
} from '@/components/share/logic/share-grants';

export type PendingShareAction =
  | { kind: 'level'; share: ShareRow; level: AccessLevel }
  | { kind: 'remove'; share: ShareRow };

interface UseShareRowActionsArgs {
  rtype: string | undefined;
  entityId: number;
  grants: ReturnType<typeof useResourceGrants>;
  grantActions: ReturnType<typeof useResourceGrantActions>;
  onUpdate?: () => void;
  currentOrgUserEmail: string | undefined;
  activeUserByEmail: Map<string, ActiveUser>;
}

/** "People with access" actions: change level, remove (dashboard: confirm first), transfer, admin takeover. */
export function useShareRowActions({
  rtype,
  entityId,
  grants,
  grantActions,
  onUpdate,
  currentOrgUserEmail,
  activeUserByEmail,
}: UseShareRowActionsArgs) {
  const { callerIsOwner, generalAccess, owner, mutate: mutateGrants } = grants;
  const { addGrants, updateGrant, removeGrant } = grantActions;

  const [rowBusyId, setRowBusyId] = useState<number | null>(null);
  // Cascade confirmation state (dashboard grants only)
  const [pendingAction, setPendingAction] = useState<PendingShareAction | null>(null);
  // Ownership transfer state
  const [transferTarget, setTransferTarget] = useState<ShareRow | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  // Admin takeover state — admin removes the current owner and becomes the
  // new owner. Uses the same transferOwnership endpoint.
  const [takeoverConfirmOpen, setTakeoverConfirmOpen] = useState(false);
  const [isTakingOver, setIsTakingOver] = useState(false);

  const doRowLevelChange = async (share: ShareRow, level: AccessLevel) => {
    if (share.access_level === level) return;
    setRowBusyId(share.share_id);
    try {
      await updateGrant(share.share_id, level);
      toastSuccess.generic(`Access updated to ${level}`);
      mutateGrants();
      onUpdate?.();
    } catch {
      // handled in hook
    } finally {
      setRowBusyId(null);
    }
  };

  const doRowRemove = async (share: ShareRow) => {
    setRowBusyId(share.share_id);
    try {
      await removeGrant(share.share_id);
      mutateGrants();
      onUpdate?.();
    } catch {
      // handled in hook
    } finally {
      setRowBusyId(null);
    }
  };

  const handleRowLevelChange = async (share: ShareRow, level: AccessLevel) => {
    if (share.access_level === level) return;
    if (rtype === 'dashboard') {
      setPendingAction({ kind: 'level', share, level });
      return;
    }
    // Cascade-only row: upgrade (direct override) is allowed, downgrade is not.
    if (share.share_id === null) {
      if (isCascadeDowngrade(share, level)) {
        toastError.api(
          `Inherited access already grants ${share.access_level}. Cannot assign a lower or equal level directly.`
        );
        return;
      }
      // Create a direct share at the higher level alongside the cascade row.
      // Invitation rows (pending) have no principal_id to upgrade.
      if (
        (share.principal_type === 'user' || share.principal_type === 'group') &&
        share.principal_id != null
      ) {
        setRowBusyId(share.principal_id);
        try {
          const res = await addGrants({
            principals: [
              {
                principal_type: share.principal_type,
                principal_id: share.principal_id,
                access_level: level,
              },
            ],
          });
          await mutateGrants({
            shares: res.shares,
            caller_is_owner: callerIsOwner,
            general_access: generalAccess!,
            owner,
          });
        } finally {
          setRowBusyId(null);
        }
      }
      return;
    }
    doRowLevelChange(share, level);
  };

  const handleRowRemove = (share: ShareRow) => {
    if (rtype === 'dashboard') {
      setPendingAction({ kind: 'remove', share });
      return;
    }
    if (share.share_id === null) {
      toastError.api(cascadeBlockMessage(share));
      return;
    }
    doRowRemove(share);
  };

  const handleCascadeConfirm = async () => {
    if (!pendingAction) return;
    if (pendingAction.kind === 'level') {
      await doRowLevelChange(pendingAction.share, pendingAction.level);
    } else {
      await doRowRemove(pendingAction.share);
    }
    setPendingAction(null);
  };

  const handleAdminTakeoverConfirm = async () => {
    const myOrguserId = currentOrgUserEmail
      ? activeUserByEmail.get(currentOrgUserEmail.toLowerCase())?.orguser_id
      : null;
    if (!rtype || !myOrguserId) return;
    setIsTakingOver(true);
    try {
      await transferOwnership(rtype, entityId, myOrguserId, true);
      mutateGrants();
      onUpdate?.();
      setTakeoverConfirmOpen(false);
    } catch {
      // handled in hook
    } finally {
      setIsTakingOver(false);
    }
  };

  const handleTransferConfirm = async () => {
    if (!transferTarget || !rtype || transferTarget.principal_id == null) return;
    setIsTransferring(true);
    try {
      await transferOwnership(rtype, entityId, transferTarget.principal_id);
      mutateGrants();
      onUpdate?.();
      setTransferTarget(null);
    } catch {
      // handled in hook
    } finally {
      setIsTransferring(false);
    }
  };

  return {
    rowBusyId,
    pendingAction,
    cancelPendingAction: () => setPendingAction(null),
    handleCascadeConfirm,
    handleRowLevelChange,
    handleRowRemove,
    transferTarget,
    setTransferTarget,
    isTransferring,
    handleTransferConfirm,
    takeoverConfirmOpen,
    setTakeoverConfirmOpen,
    isTakingOver,
    handleAdminTakeoverConfirm,
  };
}

export type ShareRowActionsState = ReturnType<typeof useShareRowActions>;
