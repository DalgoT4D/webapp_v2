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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useUserPreferences, usePreferenceActions } from '@/hooks/api/useNotifications';
import { ADMIN_ROLES, useRbac } from '@/lib/rbac';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

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
    enable_schema_change_notifications: false,
  });

  const { preferences, isLoading: isLoadingPrefs, mutate: mutateUserPrefs } = useUserPreferences();
  const { updateUserPreferences } = usePreferenceActions();
  const { hasRole } = useRbac();

  const canSeeSchemaChangeToggle = hasRole(ADMIN_ROLES);

  useEffect(() => {
    if (preferences) {
      setFormData({
        enable_email_notifications: preferences.enable_email_notifications,
        enable_schema_change_notifications: preferences.enable_schema_change_notifications ?? false,
      });
    }
  }, [preferences]);

  const resetForm = () => {
    if (preferences) {
      setFormData({
        enable_email_notifications: preferences.enable_email_notifications,
        enable_schema_change_notifications: preferences.enable_schema_change_notifications ?? false,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preferences) return;

    const payload: {
      enable_email_notifications?: boolean;
      enable_schema_change_notifications?: boolean;
    } = {};
    if (formData.enable_email_notifications !== preferences.enable_email_notifications) {
      payload.enable_email_notifications = formData.enable_email_notifications;
    }
    if (
      canSeeSchemaChangeToggle &&
      formData.enable_schema_change_notifications !==
        (preferences.enable_schema_change_notifications ?? false)
    ) {
      payload.enable_schema_change_notifications = formData.enable_schema_change_notifications;
    }

    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await updateUserPreferences(payload);
      if (!success) return;
      await mutateUserPrefs();
      toast.success('Preferences updated');
      trackEvent(ANALYTICS_EVENTS.NOTIFICATION_PREFERENCES_UPDATED);
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
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <p className="text-sm text-gray-500">Receive notifications via email</p>
            </div>
            <Switch
              id="email-notifications"
              data-testid="email-notifications-switch"
              checked={formData.enable_email_notifications}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  enable_email_notifications: checked,
                }))
              }
            />
          </div>

          {canSeeSchemaChangeToggle && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="schema-change-notifications">Schema Change Notifications</Label>
                  <p className="text-sm text-gray-500">
                    Get alerted when source schema changes are detected for your org
                  </p>
                </div>
                <Switch
                  id="schema-change-notifications"
                  data-testid="schema-change-notifications-switch"
                  checked={formData.enable_schema_change_notifications}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      enable_schema_change_notifications: checked,
                    }))
                  }
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              data-testid="preferences-cancel-btn"
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              data-testid="preferences-submit-btn"
              type="submit"
              disabled={isSubmitting || isLoadingPrefs}
            >
              {isSubmitting ? 'Updating...' : 'Update Preferences'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
