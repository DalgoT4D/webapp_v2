import { useCallback, useState } from 'react';
import { toastSuccess } from '@/lib/toast';
import { copyUrlToClipboard } from '@/lib/clipboard';
import {
  updateGeneralAccess,
  type GeneralAccessMode,
  type GeneralAccessState,
  type useResourceGrants,
} from '@/hooks/api/useAccess';

interface UseGeneralAccessChangeArgs {
  rtype: string | undefined;
  entityId: number;
  entityLabel: string;
  generalAccess: GeneralAccessState | undefined;
  mutateGrants: ReturnType<typeof useResourceGrants>['mutate'];
  onUpdate?: () => void;
  onMadePublic?: () => void;
  onCopyLink?: () => void;
}

/** General access (Everyone / Private / Public) changes and COPY PUBLIC LINK. */
export function useGeneralAccessChange({
  rtype,
  entityId,
  entityLabel,
  generalAccess,
  mutateGrants,
  onUpdate,
  onMadePublic,
  onCopyLink,
}: UseGeneralAccessChangeArgs) {
  const [modeChanging, setModeChanging] = useState(false);

  const handleModeChange = async (next: GeneralAccessMode) => {
    if (!rtype || !generalAccess || next === generalAccess.mode) return;
    if (next === 'public' && !generalAccess.allow_public_sharing) return;
    setModeChanging(true);
    try {
      const res = await updateGeneralAccess(rtype, entityId, next);
      if (next === 'public' && res.public_url) {
        toastSuccess.generic(`${entityLabel} is now public`);
        // Keep copying attached to the explicit COPY PUBLIC LINK click. Waiting for this API
        // response can consume the browser's transient user activation and make an automatic
        // clipboard write fail even though the resource was successfully made public.
        onMadePublic?.();
      } else if (next === 'internal') {
        toastSuccess.generic(`${entityLabel} is now visible to everyone in your org`);
      } else if (next === 'private') {
        toastSuccess.generic(`${entityLabel} is now private`);
      }
      mutateGrants();
      onUpdate?.();
    } catch {
      // handled in hook
    } finally {
      setModeChanging(false);
    }
  };

  const handleCopyPublicUrl = useCallback(async () => {
    if (!generalAccess?.public_url) return;
    // Only a successful explicit clipboard write counts as a share.
    if (await copyUrlToClipboard(generalAccess.public_url)) onCopyLink?.();
  }, [generalAccess?.public_url, onCopyLink]);

  return { modeChanging, handleModeChange, handleCopyPublicUrl };
}
