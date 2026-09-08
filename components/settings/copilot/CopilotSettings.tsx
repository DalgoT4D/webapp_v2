'use client';

import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiGet, apiPut } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';

interface CopilotSettingsData {
  enabled: boolean;
  text: string;
  updated_at: string | null;
  updated_by_email: string | null;
  // the org-memory char cap comes from the backend — never hardcoded here
  max_chars: number;
}

interface CopilotSettingsResponse {
  success: boolean;
  data: CopilotSettingsData;
}

const SETTINGS_KEY = '/api/chat-with-data/settings';
// mutated after a toggle so the sidebar's Copilot entry updates without a reload
const FLAGS_KEY = '/api/organizations/flags';

const CONTEXT_EXAMPLES = [
  '"\'SHG\' means self-help group"',
  '"Our fiscal year runs April–March"',
  '"Monthly program data lives in prod.survey_responses"',
  '"District codes use 2019 boundaries"',
];

export default function CopilotSettings() {
  const { mutate } = useSWRConfig();
  const { data: res, isLoading } = useSWR<CopilotSettingsResponse>(SETTINGS_KEY, apiGet, {
    revalidateOnFocus: false,
  });
  const settings = res?.data;

  const [draft, setDraft] = useState('');
  const [isToggling, setIsToggling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const savedText = settings?.text ?? '';
  // Reset the editor whenever the saved text changes (initial load, org switch)
  useEffect(() => {
    setDraft(savedText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedText]);

  const maxChars = settings?.max_chars ?? 0;
  const hasChanges = settings !== undefined && draft.trim() !== savedText;
  const overCap = maxChars > 0 && draft.trim().length > maxChars;

  const handleToggle = async (checked: boolean) => {
    setIsToggling(true);
    try {
      await apiPut(SETTINGS_KEY, { enabled: checked });
      await Promise.all([mutate(SETTINGS_KEY), mutate(FLAGS_KEY)]);
      toastSuccess.saved(checked ? 'Dalgo Copilot enabled' : 'Dalgo Copilot disabled');
    } catch (error) {
      toastError.save(error, 'Copilot settings');
    } finally {
      setIsToggling(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiPut(SETTINGS_KEY, { text: draft.trim() });
      await mutate(SETTINGS_KEY);
      toastSuccess.saved('Copilot context');
    } catch (error) {
      toastError.save(error, 'Copilot context');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b bg-background">
        <div className="p-6 pb-0 mb-6">
          <h1 className="text-3xl font-bold">Dalgo Copilot</h1>
          <p className="text-muted-foreground mt-1">
            Enable the AI assistant for your organization and teach it about your data
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 mt-6">
        <div className="max-w-3xl space-y-6">
          {/* Enable */}
          <div className="bg-white border rounded-lg p-6 flex items-center justify-between gap-6">
            <div>
              <h2 className="text-lg font-semibold">Enable Dalgo Copilot</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Admins get an AI assistant that answers questions from your warehouse in plain
                language.
              </p>
            </div>
            <Switch
              data-testid="copilot-enable-switch"
              checked={settings?.enabled ?? false}
              disabled={isLoading || isToggling}
              onCheckedChange={handleToggle}
            />
          </div>

          {/* Context */}
          <div
            className={`bg-white border rounded-lg p-6 space-y-4 ${
              settings?.enabled ? '' : 'opacity-50 pointer-events-none'
            }`}
            data-testid="copilot-context-section"
          >
            <div>
              <h2 className="text-lg font-semibold">Context</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Facts the assistant reads with every question — your vocabulary, fiscal year, and
                which tables matter. For example: {CONTEXT_EXAMPLES.join(', ')}.
              </p>
            </div>

            <Textarea
              data-testid="copilot-context-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!settings?.enabled || isSaving}
              rows={10}
              placeholder="'SHG' means self-help group. Our fiscal year runs April–March. …"
            />

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {settings?.updated_at
                  ? `Last updated by ${settings.updated_by_email ?? 'unknown'} on ${new Date(
                      settings.updated_at
                    ).toLocaleDateString()}`
                  : 'Not set yet'}
              </span>
              <span
                data-testid="copilot-char-counter"
                className={overCap ? 'text-destructive font-medium' : ''}
              >
                {draft.trim().length}/{maxChars}
              </span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="primary"
                data-testid="copilot-save-btn"
                onClick={handleSave}
                disabled={!hasChanges || overCap || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="outline"
                data-testid="copilot-cancel-btn"
                onClick={() => setDraft(savedText)}
                disabled={!hasChanges || isSaving}
              >
                Cancel
              </Button>
            </div>
          </div>

          {/* PII warning — always visible, even while the feature is disabled */}
          <div
            data-testid="copilot-pii-warning"
            className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <TriangleAlert className="h-5 w-5 flex-shrink-0 text-amber-500 mt-0.5" />
            <p>
              This text is sent to the AI provider with every Copilot message. Describe your data
              and vocabulary — never paste beneficiary names, phone numbers, or other personal
              information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
