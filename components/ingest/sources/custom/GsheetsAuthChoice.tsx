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

/**
 * The four steps that grant the service account access. `lead` sets the framing; `footer` is for
 * anything that only makes sense once the steps have been read (e.g. how to switch key instead).
 */
function ShareSteps({
  email,
  lead,
  testId,
  footer,
}: {
  email: string;
  lead: ReactNode;
  testId: string;
  footer?: ReactNode;
}) {
  return (
    <div
      className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-4"
      data-testid={testId}
    >
      {/* A div, not a <p>: the edit-mode lead is a short block with its own list. */}
      <div className="space-y-2 text-sm">{lead}</div>
      <EmailChip email={email} />
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Open your spreadsheet in Google Sheets</li>
        <li>
          Click <span className="font-medium text-foreground">Share</span> (top right)
        </li>
        <li>Paste the address above and set the role to Viewer</li>
        <li>Untick &ldquo;Notify people&rdquo;, then click Share</li>
      </ol>
      {footer && <div className="text-sm">{footer}</div>}
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
            {/* The choice only. What sharing involves, and how far the access reaches, is stated
                once — in the panel below, next to the address it applies to. */}
            <p className="text-sm text-muted-foreground">
              Quickest way to get your sheet set up. Untick to use your own service-account key
              instead.
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
              <p className="font-medium text-foreground">
                This source already has a service-account key saved.
              </p>
              <p>
                If you are using Dalgo&apos;s service account rather than your own key, share your
                spreadsheet with this address:
              </p>
            </>
          }
          // After the steps, not before them: it's the alternative to doing them.
          // The field is named rather than called "the field above" — on a form this long,
          // "above" isn't obvious.
          footer={
            <>
              To change how this source authenticates, clear the{' '}
              <span className="font-medium text-foreground">Service Account Information</span> field
              above — the &ldquo;Use Dalgo&apos;s service account&rdquo; choice comes back, and you
              can either tick it or paste a different key.
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
