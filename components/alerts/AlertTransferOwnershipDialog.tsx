'use client';

import { useMemo, useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  transferAlertOwnership,
  useAlertTransferCandidates,
  type AlertTransferCandidate,
} from '@/hooks/api/useAlerts';
import { toastError, toastSuccess } from '@/lib/toast';

interface AlertTransferOwnershipDialogProps {
  alertId: number;
  alertName: string;
  currentOwnerEmail: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTransferred?: () => void;
}

export function AlertTransferOwnershipDialog({
  alertId,
  alertName,
  currentOwnerEmail,
  isOpen,
  onClose,
  onTransferred,
}: AlertTransferOwnershipDialogProps) {
  const { candidates } = useAlertTransferCandidates(isOpen ? alertId : null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AlertTransferCandidate | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) => c.email.toLowerCase().includes(q) || (c.role_name ?? '').toLowerCase().includes(q)
    );
  }, [candidates, search]);

  const handleClose = () => {
    setSearch('');
    setSelected(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!selected) return;
    setIsTransferring(true);
    try {
      await transferAlertOwnership(alertId, selected.orguser_id);
      toastSuccess.generic(`Ownership transferred to ${selected.email}`);
      onTransferred?.();
      handleClose();
    } catch (err) {
      toastError.api(err, 'Failed to transfer ownership');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen && !selected} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer ownership of &quot;{alertName}&quot;</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {currentOwnerEmail && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Current owner:</span>
                <span className="font-medium text-foreground">{currentOwnerEmail}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="alert-transfer-search">Search for a user</Label>
              <Input
                id="alert-transfer-search"
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
                filtered.map((c) => (
                  <button
                    type="button"
                    key={c.orguser_id}
                    onClick={() => setSelected(c)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
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
                  </button>
                ))
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

      {selected && (
        <Dialog open onOpenChange={() => !isTransferring && setSelected(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Transfer ownership</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Transfer ownership of &quot;{alertName}&quot; to{' '}
              <span className="font-medium text-foreground">{selected.email}</span>? You will lose
              owner status. Editing this alert will only be possible for the new owner or an admin.
            </p>
            <div className="flex justify-end gap-3 mt-2">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={isTransferring}>
                CANCEL
              </Button>
              <Button variant="primary" onClick={handleConfirm} disabled={isTransferring}>
                {isTransferring ? 'TRANSFERRING…' : 'TRANSFER'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
