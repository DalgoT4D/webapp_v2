'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// How long the copy button shows its "copied" tick before reverting.
const COPIED_RESET_MS = 2000;

// Stand-in shown in the key field once the managed option is ticked. Display only — it is never
// written to the form, because the backend fills the slot precisely because it arrives empty.
const MANAGED_KEY_PLACEHOLDER = '*'.repeat(48);

interface GsheetsAuthChoiceProps {
  /** `client_email` of the Dalgo-managed service account. */
  email: string;
  useManagedKey: boolean;
  onUseManagedKeyChange: (next: boolean) => void;
  /** Whether the form currently holds a service-account key. */
  hasKey: boolean;
  mode: 'create' | 'edit';
  disabled?: boolean;
  error?: string;
  /** The spec-driven service-account JSON field, and its label (mirrored by the stand-in). */
  keyField: ReactNode;
  keyFieldLabel: string;
}

/** The address to share the spreadsheet with, as a click-to-copy chip. */
function EmailChip({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }, [email]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid="gsheets-managed-email"
      title="Click to copy"
      className="inline-flex max-w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-mono transition-colors hover:bg-muted cursor-pointer"
    >
      <span className="truncate">{email}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
      ) : (
        <Copy className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

/** The four steps that grant the service account access. `lead` sets the framing. */
function ShareSteps({ email, lead, testId }: { email: string; lead: ReactNode; testId: string }) {
  return (
    <div
      className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-4"
      data-testid={testId}
    >
      <p className="text-sm">{lead}</p>
      <EmailChip email={email} />
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Open your spreadsheet in Google Sheets</li>
        <li>
          Click <span className="font-medium text-foreground">Share</span> (top right)
        </li>
        <li>Paste the address above and set the role to Viewer</li>
        <li>Untick &ldquo;Notify people&rdquo;, then click Share</li>
      </ol>
    </div>
  );
}

/**
 * MANAGED-SA bridge — Google Sheets auth while OAuth verification is pending. The key field is
 * always visible; a checkbox under it opts into Dalgo's key instead of your own.
 *
 * Which key a saved source uses is NOT recorded anywhere: both options store a
 * `service_account_info` that Airbyte returns masked, so on edit this cannot tell them apart. It
 * therefore drops the checkbox while a saved key is present and states the sharing requirement
 * conditionally instead of guessing. Clearing the field brings the choice back.
 *
 * Delete with the bridge.
 */
export function GsheetsAuthChoice({
  email,
  useManagedKey,
  onUseManagedKeyChange,
  hasKey,
  mode,
  disabled,
  error,
  keyField,
  keyFieldLabel,
}: GsheetsAuthChoiceProps) {
  // Edit keeps the checkbox out of sight while a key is saved — offering it there would imply we
  // know whose key it is. Create always shows it.
  const showCheckbox = mode === 'create' || !hasKey;
  // The untouched saved key on an edit: say what sharing it needs without claiming which key.
  const showSavedKeyNote = mode === 'edit' && hasKey && !useManagedKey;

  return (
    <div className="space-y-3" data-testid="gsheets-auth-choice">
      <Label>
        Authentication <span className="text-destructive">*</span>
      </Label>

      {/* Ticked: the field keeps its place but shows a stand-in, so it reads as "already handled"
          rather than as an empty required input. */}
      {useManagedKey ? (
        <div data-testid="gsheets-managed-placeholder">
          <Label className="mb-1.5 block text-base font-medium">{keyFieldLabel}</Label>
          <Input
            value={MANAGED_KEY_PLACEHOLDER}
            readOnly
            disabled
            aria-label={keyFieldLabel}
            className="font-mono"
          />
        </div>
      ) : (
        <div data-testid="gsheets-key-field">{keyField}</div>
      )}

      {showCheckbox && (
        <div className="flex items-start gap-3">
          <Checkbox
            id="gsheets-use-managed"
            checked={useManagedKey}
            onCheckedChange={(next) => onUseManagedKeyChange(next === true)}
            disabled={disabled}
            data-testid="gsheets-use-managed-checkbox"
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label htmlFor="gsheets-use-managed" className="cursor-pointer font-medium">
              Use Dalgo&apos;s service account
            </Label>
            <p className="text-sm text-muted-foreground">
              Recommended if you don&apos;t have your own service-account key. Instead of pasting
              one, you share your spreadsheet with Dalgo&apos;s address — read-only, and only the
              sheets you share.
            </p>
          </div>
        </div>
      )}

      {useManagedKey && (
        <ShareSteps
          email={email}
          testId="gsheets-managed-steps"
          lead="Share your spreadsheet with this address before saving — Dalgo can then read that sheet, and nothing else in your Drive."
        />
      )}

      {showSavedKeyNote && (
        <ShareSteps
          email={email}
          testId="gsheets-saved-key-note"
          lead={
            <>
              <span className="font-medium">If this source uses Dalgo&apos;s service account</span>,
              the address below needs Viewer access on the spreadsheet — do these steps too. If you
              are using your own key, share the sheet with your own account&apos;s address instead.
              To switch, clear the field above.
            </>
          }
        />
      )}

      {error && (
        <p className="text-xs text-destructive" data-testid="gsheets-auth-error">
          {error}
        </p>
      )}
    </div>
  );
}
