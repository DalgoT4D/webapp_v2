'use client';

import { useEffect } from 'react';
import { PeopleTable } from './PeopleTable';
import { InviteUserDialog } from './InviteUserDialog';
import { trackFeatureView } from '@/lib/analytics';
import { FEATURES } from '@/constants/analytics';

interface UserManagementProps {
  /** The INVITE USER button lives on the Access page header; dialog state is lifted there. */
  showInviteDialog: boolean;
  onShowInviteDialogChange: (open: boolean) => void;
}

// People panel of Settings → Access. The page-level header (title, tabs,
// INVITE USER button) is owned by AccessPage; this renders the merged
// people table — one list of active users and pending invitations,
// distinguished by row icon (see PeopleTable) — with no secondary
// Users/Pending-Invitations tabs.
export default function UserManagement({
  showInviteDialog,
  onShowInviteDialogChange,
}: UserManagementProps) {
  useEffect(() => {
    trackFeatureView(FEATURES.SETTINGS_USER_MANAGEMENT);
  }, []);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 w-full px-6 pt-6 pb-6 overflow-y-auto min-h-0">
        <PeopleTable onInviteClick={() => onShowInviteDialogChange(true)} />
      </div>

      <InviteUserDialog open={showInviteDialog} onOpenChange={onShowInviteDialogChange} />
    </div>
  );
}
