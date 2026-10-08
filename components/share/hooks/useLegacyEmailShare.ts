import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { toastSuccess, toastError } from '@/lib/toast';
import { EMAIL_REGEX, MAX_RECIPIENTS } from '@/components/reports/utils';

type ShareViaEmail = (data: {
  recipient_emails: string[];
  message?: string;
}) => Promise<{ recipients_count: number; message: string }>;

interface UseLegacyEmailShareArgs {
  isOpen: boolean;
  entityLabel: string;
  onShareViaEmail?: ShareViaEmail;
}

/** Legacy "Share via Email" section state (rendered only when a caller passes onShareViaEmail — none does today). */
export function useLegacyEmailShare({
  isOpen,
  entityLabel,
  onShareViaEmail,
}: UseLegacyEmailShareArgs) {
  const [emailInput, setEmailInput] = useState('');
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [personalMessage, setPersonalMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setRecipientEmails([]);
      setPersonalMessage('');
      setEmailInput('');
    }
  }, [isOpen]);

  const handleAddEmail = useCallback(() => {
    const email = emailInput.trim();
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      toastError.api('Please enter a valid email address');
      return;
    }
    if (recipientEmails.includes(email)) {
      toastError.api('Email already added');
      return;
    }
    if (recipientEmails.length >= MAX_RECIPIENTS) {
      toastError.api(`Maximum ${MAX_RECIPIENTS} recipients allowed`);
      return;
    }
    setRecipientEmails((prev) => [...prev, email]);
    setEmailInput('');
  }, [emailInput, recipientEmails]);

  const handleRemoveRecipient = useCallback((email: string) => {
    setRecipientEmails((prev) => prev.filter((e) => e !== email));
  }, []);

  const handleEmailKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddEmail();
      }
    },
    [handleAddEmail]
  );

  const handleSendEmails = useCallback(async () => {
    if (!onShareViaEmail || recipientEmails.length === 0) return;
    setIsSending(true);
    try {
      const result = await onShareViaEmail({
        recipient_emails: recipientEmails,
        message: personalMessage || undefined,
      });
      toastSuccess.generic(
        `${entityLabel} is being sent to ${result.recipients_count} recipient${
          result.recipients_count > 1 ? 's' : ''
        }`
      );
      setRecipientEmails([]);
      setPersonalMessage('');
    } catch {
      toastError.api('Failed to send emails');
    } finally {
      setIsSending(false);
    }
  }, [onShareViaEmail, recipientEmails, personalMessage, entityLabel]);

  return {
    emailInput,
    setEmailInput,
    recipientEmails,
    personalMessage,
    setPersonalMessage,
    isSending,
    handleAddEmail,
    handleRemoveRecipient,
    handleEmailKeyDown,
    handleSendEmails,
  };
}

export type LegacyEmailShareState = ReturnType<typeof useLegacyEmailShare>;
