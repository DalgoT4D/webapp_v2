import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useUserPreferences,
  useOrgPreferences,
  usePreferenceActions,
} from '@/hooks/api/useNotifications';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { PERMISSIONS } from '@/constants/notifications';

interface NotificationPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationPreferencesDialog({
  open,
  onOpenChange,
}: NotificationPreferencesDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    enable_email_notifications: false,
    enable_discord_notifications: false,
    discord_webhook: '',
  });
  const [errors, setErrors] = useState<{ discord_webhook?: string }>({});

  const {
    preferences,
    isLoading: userPrefsLoading,
    mutate: mutateUserPrefs,
  } = useUserPreferences();
  const {
    orgPreferences,
    isLoading: orgPrefsLoading,
    mutate: mutateOrgPrefs,
  } = useOrgPreferences();
  const isLoadingPrefs = userPrefsLoading || orgPrefsLoading;
  const { updateUserPreferences, updateOrgPreferences } = usePreferenceActions();
  const { hasPermission } = useUserPermissions();

  const hasDiscordPermission = hasPermission(PERMISSIONS.EDIT_ORG_NOTIFICATION_SETTINGS);

  // Load existing preferences when dialog opens
  useEffect(() => {
    if (preferences && orgPreferences) {
      setFormData({
        enable_email_notifications: preferences.enable_email_notifications,
        enable_discord_notifications: orgPreferences.enable_discord_notifications,
        discord_webhook: orgPreferences.discord_webhook || '',
      });
    }
  }, [preferences, orgPreferences]);

  const validateForm = () => {
    const newErrors: { discord_webhook?: string } = {};

    if (formData.enable_discord_notifications && !formData.discord_webhook.trim()) {
      newErrors.discord_webhook = 'Discord webhook URL is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setErrors({});
    if (preferences && orgPreferences) {
      setFormData({
        enable_email_notifications: preferences.enable_email_notifications,
        enable_discord_notifications: orgPreferences.enable_discord_notifications,
        discord_webhook: orgPreferences.discord_webhook || '',
      });
    }
  };

  const getChangedSections = () => {
    const emailChanged =
      !!preferences &&
      formData.enable_email_notifications !== preferences.enable_email_notifications;

    const discordChanged =
      hasDiscordPermission &&
      !!orgPreferences &&
      (formData.enable_discord_notifications !== orgPreferences.enable_discord_notifications ||
        formData.discord_webhook !== (orgPreferences.discord_webhook || ''));

    return { emailChanged, discordChanged };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const { emailChanged, discordChanged } = getChangedSections();

    setIsSubmitting(true);

    try {
      if (emailChanged) {
        const success = await updateUserPreferences({
          enable_email_notifications: formData.enable_email_notifications,
        });
        if (!success) return;
      }

      if (discordChanged) {
        const success = await updateOrgPreferences({
          enable_discord_notifications: formData.enable_discord_notifications,
          discord_webhook: formData.discord_webhook,
        });
        if (!success) return;
      }

      if (emailChanged) {
        await mutateUserPrefs();
        toast.success('Email preferences updated');
      }
      if (discordChanged) {
        await mutateOrgPrefs();
        toast.success('Discord preferences updated');
      }

      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Preferences</DialogTitle>
          <DialogDescription>Configure your notification preferences</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <p className="text-sm text-gray-500">Receive notifications via email</p>
            </div>
            <Switch
              id="email-notifications"
              checked={formData.enable_email_notifications}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  enable_email_notifications: checked,
                }))
              }
            />
          </div>

          <Separator />

          {/* Discord Notifications */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="discord-notifications">Discord Notifications</Label>
                <p className="text-sm text-gray-500">Send notifications to Discord channel</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Switch
                      id="discord-notifications"
                      checked={formData.enable_discord_notifications}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          enable_discord_notifications: checked,
                        }))
                      }
                      disabled={!hasDiscordPermission}
                    />
                  </div>
                </TooltipTrigger>
                {!hasDiscordPermission && (
                  <TooltipContent>
                    Please reach out to your organization&apos;s Account Manager to enable this
                    feature
                  </TooltipContent>
                )}
              </Tooltip>
            </div>

            {formData.enable_discord_notifications && (
              <div className="space-y-2">
                <Label htmlFor="discord-webhook">Discord Webhook URL</Label>
                <Input
                  id="discord-webhook"
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={formData.discord_webhook}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      discord_webhook: e.target.value,
                    }))
                  }
                  disabled={!hasDiscordPermission}
                  className={errors.discord_webhook ? 'border-red-500' : ''}
                />
                {errors.discord_webhook && (
                  <p className="text-sm text-red-500">{errors.discord_webhook}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoadingPrefs}>
              {isSubmitting ? 'Updating...' : 'Update Preferences'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
