'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  Building2,
  Globe,
  ImageIcon,
  Info,
  Shield,
  Bot,
  Upload,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiGet, apiPut, apiPost } from '@/lib/api';

interface OrgSettings {
  organization_name: string | null;
  website: string | null;
  organization_logo_filename: string | null;
  ai_data_sharing_enabled: boolean;
  ai_logging_acknowledged: boolean;
  ai_settings_accepted_by_email?: string | null;
  ai_settings_accepted_at?: string | null;
}

export default function OrganizationSettings() {
  const [settings, setSettings] = useState<OrgSettings>({
    organization_name: '',
    website: '',
    organization_logo_filename: '',
    ai_data_sharing_enabled: false,
    ai_logging_acknowledged: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadOrgSettings();
  }, []);

  const loadOrgSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiGet('/api/org-settings/');

      if (response?.success && response?.res) {
        // Handle null values from API more explicitly
        const newSettings = {
          organization_name: response.res.organization_name ?? '',
          website: response.res.website ?? '',
          organization_logo_filename: response.res.organization_logo_filename ?? '',
          ai_data_sharing_enabled: response.res.ai_data_sharing_enabled ?? false,
          ai_logging_acknowledged: response.res.ai_logging_acknowledged ?? false,
          ai_settings_accepted_by_email: response.res.ai_settings_accepted_by_email,
          ai_settings_accepted_at: response.res.ai_settings_accepted_at,
        };

        setSettings(newSettings);

        // Load logo preview if exists
        if (response.res.organization_logo_filename) {
          setLogoPreview(
            `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002'}/api/org-settings/logo`
          );
        }
      }
    } catch (err: any) {
      console.error('Failed to load organization settings:', err);
      setError('Failed to load organization settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Only send non-empty values
      const updateData: any = {
        ai_data_sharing_enabled: settings.ai_data_sharing_enabled,
        ai_logging_acknowledged: settings.ai_logging_acknowledged,
      };

      if (settings.organization_name && settings.organization_name.trim()) {
        updateData.organization_name = settings.organization_name.trim();
      }

      if (settings.website && settings.website.trim()) {
        updateData.website = settings.website.trim();
      }

      const response = await apiPut('/api/org-settings/', updateData);

      if (response.success) {
        // Update local state with the response data to ensure consistency
        if (response.res) {
          setSettings((prev) => ({
            ...prev,
            organization_name: response.res.organization_name ?? prev.organization_name,
            website: response.res.website ?? prev.website,
            ai_data_sharing_enabled:
              response.res.ai_data_sharing_enabled ?? prev.ai_data_sharing_enabled,
            ai_logging_acknowledged:
              response.res.ai_logging_acknowledged ?? prev.ai_logging_acknowledged,
            ai_settings_accepted_by_email: response.res.ai_settings_accepted_by_email,
            ai_settings_accepted_at: response.res.ai_settings_accepted_at,
          }));
        }

        // Show brief success state
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);

        toast({
          title: '✅ Settings Saved Successfully',
          description: 'Your organization settings have been updated and saved.',
          duration: 5000, // Show for 5 seconds
        });
      } else {
        throw new Error(response.message || 'Failed to save settings');
      }
    } catch (err: any) {
      console.error('Failed to save organization settings:', err);
      setError('Failed to save settings. Please try again.');
      toast({
        title: '❌ Save Failed',
        description: err.message || 'Failed to save organization settings. Please try again.',
        variant: 'destructive',
        duration: 6000, // Show error longer
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof OrgSettings, value: string | boolean) => {
    setSettings((prev) => {
      const newSettings = { ...prev, [field]: value };

      // Dependency: If data sharing is disabled, also disable logging acknowledgment
      if (field === 'ai_data_sharing_enabled' && !value) {
        newSettings.ai_logging_acknowledged = false;
      }

      return newSettings;
    });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a valid image file (JPEG, PNG, GIF, or WebP)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'File Too Large',
        description: 'Please upload an image smaller than 10MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUploadingLogo(true);
      setError(null);

      const formData = new FormData();
      formData.append('logo_file', file);

      const selectedOrg = localStorage.getItem('selectedOrg');
      const headers: HeadersInit = {};
      if (selectedOrg) {
        headers['x-dalgo-org'] = selectedOrg;
      }
      // Don't set Content-Type for FormData - browser will set it automatically with boundary

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002'}/api/org-settings/upload-logo`,
        {
          method: 'POST',
          body: formData,
          headers,
          credentials: 'include', // Use cookies for authentication, same as other API calls
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        // Update the settings to show the new filename
        setSettings((prev) => ({
          ...prev,
          organization_logo_filename: result.filename,
        }));

        // Update preview with timestamp to force reload
        setLogoPreview(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002'}/api/org-settings/logo?t=${Date.now()}`
        );

        toast({
          title: 'Logo Uploaded',
          description: 'Organization logo has been uploaded successfully.',
        });
      } else {
        throw new Error(result.message || 'Failed to upload logo');
      }
    } catch (err: any) {
      console.error('Failed to upload logo:', err);
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload logo. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingLogo(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    // For simplicity, we'll just clear the preview and filename
    // In a full implementation, you might want an actual delete endpoint
    setLogoPreview(null);
    setSettings((prev) => ({ ...prev, organization_logo_filename: '' }));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Loading organization settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="container mx-auto p-6 max-w-4xl min-h-screen">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Organization Settings</h1>
          <p className="text-muted-foreground">
            Configure your organization details and AI preferences
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Organization Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="organization_name">Organization Name (Optional)</Label>
                <Input
                  id="organization_name"
                  placeholder="Enter organization name"
                  value={settings.organization_name || ''}
                  onChange={(e) => handleInputChange('organization_name', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  The display name for your organization
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website (Optional)
                </Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://example.com"
                  value={settings.website || ''}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">Your organization's website URL</p>
              </div>

              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Organization Logo (Optional)
                </Label>

                {/* Logo Preview */}
                {logoPreview && (
                  <div className="relative inline-block">
                    <img
                      src={logoPreview}
                      alt="Organization Logo"
                      className="w-32 h-32 object-contain border rounded-lg bg-gray-50"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 rounded-full w-6 h-6 p-0"
                      onClick={handleRemoveLogo}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* File Upload */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Label
                      htmlFor="logo-upload"
                      className={`flex items-center gap-2 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer ${isUploadingLogo ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Upload className="h-4 w-4" />
                      {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    </Label>
                  </div>

                  {settings.organization_logo_filename && (
                    <span className="text-sm text-muted-foreground">
                      Current: {settings.organization_logo_filename}
                    </span>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  Upload your organization's logo image (JPEG, PNG, GIF, or WebP, max 10MB)
                </p>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* AI Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* AI Logging Notice */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    Dalgo uses external AI models and logs all AI questions and answers for at least
                    3 months.
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleInputChange(
                              'ai_logging_acknowledged',
                              !settings.ai_logging_acknowledged
                            )
                          }
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          By acknowledging this, you confirm understanding that AI interactions are
                          logged and stored for quality and compliance purposes for a minimum of 3
                          months.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </AlertDescription>
              </Alert>

              {/* Data Sharing Setting */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ai_data_sharing" className="text-base font-medium">
                      Accept usage of AI and share data
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Share your organization data with AI to help make the responses better
                            and contextual. This enables the AI to provide more accurate insights
                            based on your actual data.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enable data sharing for better contextual AI responses
                  </p>
                </div>
                <Switch
                  id="ai_data_sharing"
                  checked={settings.ai_data_sharing_enabled}
                  onCheckedChange={(checked) =>
                    handleInputChange('ai_data_sharing_enabled', checked)
                  }
                />
              </div>

              <div
                className={`flex items-center justify-between p-4 border rounded-lg ${!settings.ai_data_sharing_enabled ? 'opacity-50' : ''}`}
              >
                <div className="space-y-1">
                  <Label htmlFor="ai_logging_acknowledged" className="text-base font-medium">
                    I acknowledge AI logging
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {!settings.ai_data_sharing_enabled
                      ? 'Enable data sharing first to acknowledge AI logging'
                      : 'Confirm understanding of AI data logging practices'}
                  </p>
                </div>
                <Switch
                  id="ai_logging_acknowledged"
                  checked={settings.ai_logging_acknowledged}
                  disabled={!settings.ai_data_sharing_enabled}
                  onCheckedChange={(checked) =>
                    handleInputChange('ai_logging_acknowledged', checked)
                  }
                />
              </div>

              {/* Privacy Notice */}
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Privacy:</strong> Your data is processed securely and is not permanently
                  stored by the AI service. All data sharing follows strict privacy and security
                  protocols.
                </AlertDescription>
              </Alert>

              {/* AI Settings Tracking Info */}
              {settings.ai_settings_accepted_by_email && settings.ai_settings_accepted_at && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Last Modified:</strong> AI settings were last updated by{' '}
                    <span className="font-medium">{settings.ai_settings_accepted_by_email}</span> on{' '}
                    <span className="font-medium">
                      {new Date(settings.ai_settings_accepted_at).toLocaleString()}
                    </span>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end pt-4 pb-8">
            <Button
              onClick={saveSettings}
              disabled={isSaving}
              className={`w-full sm:w-auto min-w-[140px] transition-all duration-200 ${
                justSaved ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''
              }`}
              size="lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : justSaved ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
