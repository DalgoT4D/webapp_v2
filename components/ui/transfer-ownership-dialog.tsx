'use client';

import { useMemo, useState } from 'react';
import { User as UserIcon, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  transferOwnership,
  useTransferCandidates,
  type TransferCandidate,
} from '@/hooks/api/useAccess';

interface TransferOwnershipDialogProps {
  rtype: string;
  entityId: number;
  entityLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onTransferred?: () => void;
}

/** Two-step transfer flow (per spec):
 *  1. Pick a target from the candidates list (search + eligibility gating)
 *  2. Confirm in a separate dialog with the warning text. */
export function TransferOwnershipDialog({
  rtype,
  entityId,
  entityLabel,
  isOpen,
  onClose,
  onTransferred,
}: TransferOwnershipDialogProps) {
  const { candidates } = useTransferCandidates(isOpen ? rtype : null, isOpen ? entityId : null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TransferCandidate | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = (candidates ?? []).filter((c) => !c.is_owner);
    if (!q) return rows;
    return rows.filter(
      (c) => c.email.toLowerCase().includes(q) || (c.role_name ?? '').toLowerCase().includes(q)
    );
  }, [candidates, search]);

  const handleClose = () => {
    setSearch('');
    setSelected(null);
    onClose();
  };

  const handleConfirmTransfer = async () => {
    if (!selected) return;
    setIsTransferring(true);
    try {
      await transferOwnership(rtype, entityId, selected.orguser_id);
      onTransferred?.();
      handleClose();
    } catch {
      // toast handled in hook
    } finally {
      setIsTransferring(false);
    }
  };

  const disabledReason = (c: TransferCandidate): string | null => {
    if (c.access_level === 'edit') return null;
    if (c.access_level === 'view') {
      return 'This user has View access only. Grant them Edit first, then try again.';
    }
    return 'This user has no access. Share the resource with them at Edit level first.';
  };

  return (
    <>
      <Dialog open={isOpen && !selected} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer ownership of &quot;{entityLabel}&quot;</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="transfer-search">Search for a user</Label>
              <Input
                id="transfer-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type name or email…"
                autoFocus
              />
            </div>

            <div className="border rounded-md max-h-80 overflow-y-auto divide-y">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No users match.</div>
              ) : (
                <TooltipProvider delayDuration={150}>
                  {filtered.map((c) => {
                    const reason = disabledReason(c);
                    const disabled = reason !== null;
                    const row = (
                      <button
                        type="button"
                        key={c.orguser_id}
                        disabled={disabled}
                        onClick={() => !disabled && setSelected(c)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <span className="inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary">
                          <UserIcon className="h-4 w-4" />
                        </span>
                        <span className="text-sm text-gray-900 truncate">{c.email}</span>
                        {c.role_name && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {c.role_name}
                          </Badge>
                        )}
                        {disabled && (
                          <span className="ml-auto text-xs text-muted-foreground shrink-0">
                            {c.access_level === 'view' ? 'View only' : 'No access'}
                          </span>
                        )}
                      </button>
                    );
                    return disabled ? (
                      <Tooltip key={c.orguser_id}>
                        <TooltipTrigger asChild>
                          <div>{row}</div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{reason}</TooltipContent>
                      </Tooltip>
                    ) : (
                      row
                    );
                  })}
                </TooltipProvider>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              CANCEL
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2: confirmation */}
      {selected && (
        <Dialog open onOpenChange={() => !isTransferring && setSelected(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Transfer ownership</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Transfer ownership of &quot;{entityLabel}&quot; to{' '}
              <span className="font-medium text-foreground">{selected.email}</span>? You will lose
              owner status. Your access will revert to your role permissions or any direct share you
              hold.
            </p>
            <div className="flex justify-end gap-3 mt-2">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={isTransferring}>
                CANCEL
              </Button>
              <Button variant="primary" onClick={handleConfirmTransfer} disabled={isTransferring}>
                {isTransferring ? 'TRANSFERRING…' : 'TRANSFER'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
