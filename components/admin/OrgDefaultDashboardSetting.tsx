'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Home, AlertTriangle, Shield } from 'lucide-react';
import { useDashboards } from '@/hooks/api/useDashboards';
import { useOrgLandingSettings } from '@/hooks/api/useLandingPreference';

export function OrgDefaultDashboardSetting() {
  const { data: dashboards, isLoading: dashboardsLoading } = useDashboards();
  const {
    data: orgSettings,
    isLoading: settingsLoading,
    isAdmin,
    setOrgDefaultDashboard,
  } = useOrgLandingSettings();

  const [selectedDashboard, setSelectedDashboard] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when org settings load
  useEffect(() => {
    if (orgSettings?.default_dashboard_id) {
      setSelectedDashboard(orgSettings.default_dashboard_id.toString());
    } else {
      setSelectedDashboard('');
    }
  }, [orgSettings]);

  // Don't render if user is not admin
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Shield className="h-5 w-5" />
            <span>Admin permissions required to configure organization defaults.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setOrgDefaultDashboard(selectedDashboard ? parseInt(selectedDashboard) : null);
    } catch (error) {
      console.error('Failed to save default dashboard:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      await setOrgDefaultDashboard(null);
      setSelectedDashboard('');
    } catch (error) {
      console.error('Failed to clear default dashboard:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const currentDefaultDashboard = dashboards?.find(
    (d) => d.id === orgSettings?.default_dashboard_id
  );

  if (dashboardsLoading || settingsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          <CardTitle>Default Landing Dashboard</CardTitle>
          <Badge variant="secondary" className="text-xs">
            Admin Only
          </Badge>
        </div>
        <CardDescription>
          Set which dashboard new users and users without personal preferences see when they log in.
          This applies organization-wide as a fallback when users haven't set their own preference.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentDefaultDashboard && (
          <Alert>
            <Home className="h-4 w-4" />
            <AlertDescription>
              <strong>Current default:</strong> {currentDefaultDashboard.dashboard_title}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Label htmlFor="dashboard-select">Select Dashboard</Label>
          <Select
            value={selectedDashboard}
            onValueChange={setSelectedDashboard}
            disabled={isSaving}
          >
            <SelectTrigger id="dashboard-select">
              <SelectValue placeholder="Choose a dashboard or leave blank for no default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No default (users see blank state)</SelectItem>
              {dashboards?.map((dashboard) => (
                <SelectItem key={dashboard.id} value={dashboard.id.toString()}>
                  <div className="flex flex-col">
                    <span>{dashboard.dashboard_title}</span>
                    {dashboard.description && (
                      <span className="text-xs text-muted-foreground">{dashboard.description}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={
              isSaving ||
              selectedDashboard === (orgSettings?.default_dashboard_id?.toString() || '')
            }
            className="min-w-[120px]"
          >
            {isSaving ? 'Saving...' : 'Save Default'}
          </Button>

          {orgSettings?.default_dashboard_id && (
            <Button variant="outline" onClick={handleClear} disabled={isSaving}>
              Clear Default
            </Button>
          )}
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Note:</strong> This setting affects all users in your organization who haven't
            set a personal landing page preference. Users can override this by setting their own
            landing page from any dashboard.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
