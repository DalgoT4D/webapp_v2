'use client';

import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PrincipalTypeahead } from '@/components/ui/principal-typeahead';
import { StagedPrincipalRow } from '@/components/ui/staged-principal-row';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AccessLevel } from '@/types/access';
import type { Role } from '@/types/user-management';
import { describePendingEmails, type ActiveUser } from '@/components/share/logic/share-grants';
import type { ShareChipsState } from '@/components/share/hooks/useShareChips';

interface PeoplePickerProps {
  staging: ShareChipsState;
  isAdmin: boolean;
  roles: Role[] | undefined;
  activeUserByEmail: Map<string, ActiveUser>;
}

/** Search people/groups/emails, the staged list with View/Edit, and the invite-role block for new emails. */
export function PeoplePicker({ staging, isAdmin, roles, activeUserByEmail }: PeoplePickerProps) {
  const { chips } = staging;

  return (
    <>
      {/* Search input */}
      <div className="space-y-2">
        <Label htmlFor="share-input">Search for people, group or add emails</Label>
        <PrincipalTypeahead
          inputId="share-input"
          inputTestId="share-chip-input"
          placeholder="Type or paste emails…"
          value={staging.chipInput}
          onChange={staging.handleChipInputChange}
          suggestions={staging.suggestions}
          onSelectUser={staging.addUserChip}
          onSelectGroup={staging.addGroupChip}
          onCommitEmail={staging.addEmailChip}
          onBackspace={staging.removeLastChip}
          onPasteEmails={(parts) => parts.forEach((p) => staging.addEmailChip(p))}
          error={staging.chipError}
        />
      </div>

      {/* Staged items (users/groups/pending emails to be shared with on Share).
          Capped + scrollable so a long paste doesn't push the rest of the modal
          (People with access, General access, Share button) out of view. */}
      {chips.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {chips.map((chip) => {
            const roleName =
              chip.kind === 'user'
                ? activeUserByEmail.get(chip.label.toLowerCase())?.role_name
                : null;
            return (
              <StagedPrincipalRow
                key={chip.key}
                kind={chip.kind}
                label={chip.label}
                badge={roleName ?? null}
                actions={
                  <>
                    <Select
                      value={chip.access_level}
                      onValueChange={(v) => staging.setChipLevel(chip.key, v as AccessLevel)}
                    >
                      <SelectTrigger
                        className="h-8 w-auto gap-1 border-0 bg-transparent px-2 text-sm text-gray-700 shadow-none hover:bg-gray-100 focus:ring-0 focus-visible:ring-0"
                        data-testid={`share-chip-level-${chip.key}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value="view"
                          data-testid={`share-chip-level-${chip.key}-option-view`}
                        >
                          View
                        </SelectItem>
                        <SelectItem
                          value="edit"
                          data-testid={`share-chip-level-${chip.key}-option-edit`}
                        >
                          Edit
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
                      onClick={() => staging.removeChip(chip.key)}
                      aria-label={`Remove ${chip.label}`}
                      data-testid={`share-chip-remove-${chip.key}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                }
              />
            );
          })}
        </div>
      )}

      {/* Warning + invite-role selector for pending chips */}
      {staging.hasPendingChips && (
        <>
          <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3">
            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-orange-800">
              <strong>{describePendingEmails(chips)}</strong>
              {isAdmin ? (
                <div>Choose a role for new invites before sharing.</div>
              ) : (
                <div>
                  They will be invited as <strong>Member</strong>.
                </div>
              )}
            </div>
          </div>
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="invite-role">Invite new users as</Label>
              <Select value={staging.inviteRoleUuid} onValueChange={staging.handleInviteRoleChange}>
                <SelectTrigger
                  id="invite-role"
                  className={staging.roleError ? 'border-red-500' : ''}
                  data-testid="share-invite-role"
                >
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {(roles ?? []).map((role) => (
                    <SelectItem
                      key={role.uuid}
                      value={role.uuid}
                      data-testid={`share-invite-role-option-${role.uuid}`}
                    >
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {staging.roleError && (
                <p className="text-sm text-red-500" data-testid="share-invite-role-error">
                  {staging.roleError}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
