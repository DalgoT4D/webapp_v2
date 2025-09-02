'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Settings, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { OrgDefaultDashboardSetting } from '@/components/admin/OrgDefaultDashboardSetting';

export default function LandingSettingsPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Landing Page Settings</h1>
          <Badge variant="secondary">Admin</Badge>
        </div>
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Impact at a Glance Configuration
          </CardTitle>
          <CardDescription>
            Configure the default landing experience for your organization. These settings determine
            what users see when they first log in to Dalgo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div>
              <strong>How it works:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                <li>Users can set their own personal landing dashboard from any dashboard page</li>
                <li>If a user hasn't set a preference, they'll see the organization default</li>
                <li>
                  If no organization default is set, users see a blank state with dashboard
                  selection
                </li>
                <li>
                  Users can always override organization defaults with their personal preferences
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Default Dashboard Setting */}
      <OrgDefaultDashboardSetting />

      {/* Future Settings Placeholder */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Additional landing page customization options coming soon...</p>
            <p className="text-xs mt-1">
              Future updates will include branding, welcome messages, and more
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
