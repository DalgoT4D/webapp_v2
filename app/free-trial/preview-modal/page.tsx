'use client';

// TEMPORARY visual-check page — delete after screenshotting the subscription modals.
import { useState } from 'react';
import {
  SubscriptionRequestModal,
  type SubscriptionRequestStage,
} from '@/components/onboarding/subscription-request-modal';

export default function PreviewSubscriptionModalPage() {
  const [stage, setStage] = useState<SubscriptionRequestStage>('sent');

  return (
    <div className="h-screen w-full bg-gray-100 p-10">
      <div className="mb-6 flex gap-3">
        {(['confirm', 'sending', 'sent'] as SubscriptionRequestStage[]).map((s) => (
          <button
            key={s}
            id={`preview-stage-${s}`}
            data-testid={`preview-stage-${s}`}
            className="rounded border bg-white px-4 py-2"
            onClick={() => setStage(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="space-y-2 text-sm text-gray-500">
        <p>Background content behind the modal, to make transparency obvious.</p>
        <p>Google Sheets connection</p>
        <p>Health Connection</p>
        <p>Education NGO Airtable Connection</p>
      </div>
      <SubscriptionRequestModal
        stage={stage}
        onConfirm={() => setStage('sent')}
        onClose={() => setStage('idle')}
      />
    </div>
  );
}
