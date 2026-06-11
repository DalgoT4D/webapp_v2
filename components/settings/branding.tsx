'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, Link2, TriangleAlert, Trash2 } from 'lucide-react';
import { BrandingPreview } from './branding-preview';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSWRConfig } from 'swr';
import { apiDelete, apiPost, apiPostFormData } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface OrgLogoData {
  logo_url: string;
  logo_filename: string | null;
  updated_at: string;
}

interface OrgLogoApiResponse {
  success: boolean;
  data: OrgLogoData;
}

type LogoSource = 'upload' | 'url';

// Must match MAX_FILE_SIZE_BYTES in DDP_backend/ddpui/utils/s3_utils.py
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function UnsavedChangesDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="branding-unsaved-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-amber-500" />
            Unsaved Changes
          </AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. Are you sure you want to leave without saving?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="branding-unsaved-dialog-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="branding-unsaved-dialog-confirm"
            className="bg-destructive text-white hover:bg-destructive/90 uppercase font-medium"
            onClick={onConfirm}
          >
            Leave Without Saving
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function Branding() {
  const { orgUsers, setOrgUsers, currentOrg } = useAuthStore();
  const { mutate } = useSWRConfig();

  const [activeTab, setActiveTab] = useState<'upload' | 'link'>('upload');
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(currentOrg?.logo_url ?? null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(currentOrg?.logo_url ?? null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [savedLogoSource, setSavedLogoSource] = useState<LogoSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync when org switches or logo_url changes externally; derive source from DB logo_filename
  useEffect(() => {
    const logoUrl = currentOrg?.logo_url ?? null;
    setCurrentLogoUrl(logoUrl);
    setPreviewLogoUrl(logoUrl);
    const source: LogoSource | null = logoUrl
      ? currentOrg?.logo_filename
        ? 'upload'
        : 'url'
      : null;
    setSavedLogoSource(source);
    if (source) setActiveTab(source === 'upload' ? 'upload' : 'link');
  }, [currentOrg?.slug, currentOrg?.logo_url, currentOrg?.logo_filename]);

  // Blob URL lifecycle: create when a file is selected, revoke on change or unmount
  useEffect(() => {
    if (!selectedFile) return undefined;
    const url = URL.createObjectURL(selectedFile);
    setPreviewLogoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const handleFileSelect = useCallback((file: File) => {
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      toastError.api('File size exceeds the 5MB limit. Please choose a smaller image.');
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleLinkChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLinkInput(e.target.value);
    setPreviewLogoUrl(e.target.value || null);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      let savedUrl: string | null = null;
      let res: OrgLogoApiResponse | null = null;

      if (activeTab === 'upload' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        res = await apiPostFormData('/api/org/logo/upload/', formData);
        savedUrl = res.data.logo_url;
      } else if (activeTab === 'link' && linkInput.trim()) {
        res = await apiPost('/api/org/logo/url/', {
          image_url: linkInput.trim(),
        });
        savedUrl = res.data.logo_url;
      }

      setCurrentLogoUrl(savedUrl);
      setPreviewLogoUrl(savedUrl);
      setSelectedFile(null);
      setLinkInput('');
      setIsEditingLink(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (currentOrg) {
        const savedFilename = res?.data?.logo_filename ?? null;
        setSavedLogoSource(savedUrl ? (activeTab === 'upload' ? 'upload' : 'url') : null);
        setOrgUsers(
          orgUsers.map((ou) =>
            ou.org.slug === currentOrg.slug
              ? {
                  ...ou,
                  org: { ...ou.org, logo_url: savedUrl ?? undefined, logo_filename: savedFilename },
                }
              : ou
          )
        );
      }

      await mutate('/api/currentuserv2');

      trackEvent(ANALYTICS_EVENTS.BRANDING_LOGO_SAVED, {
        logo_source: activeTab,
        filename: res?.data?.logo_filename ?? null,
        logo_url: savedUrl,
      });
      toastSuccess.saved('Organization logo');
    } catch (error) {
      toastError.save(error, 'logo');
    } finally {
      setIsSaving(false);
    }
  }, [activeTab, selectedFile, linkInput, currentOrg, orgUsers, setOrgUsers, mutate]);

  const handleRemove = useCallback(async () => {
    setIsRemoving(true);
    try {
      await apiDelete('/api/org/logo/');

      setCurrentLogoUrl(null);
      setPreviewLogoUrl(null);
      setSavedLogoSource(null);

      if (currentOrg) {
        setOrgUsers(
          orgUsers.map((ou) =>
            ou.org.slug === currentOrg.slug
              ? { ...ou, org: { ...ou.org, logo_url: undefined, logo_filename: null } }
              : ou
          )
        );
      }

      await mutate('/api/currentuserv2');

      trackEvent(ANALYTICS_EVENTS.BRANDING_LOGO_REMOVED, { logo_source: savedLogoSource });
      toastSuccess.saved('Organization logo removed');
    } catch (error) {
      toastError.save(error, 'logo');
    } finally {
      setIsRemoving(false);
    }
  }, [currentOrg, orgUsers, setOrgUsers, mutate, savedLogoSource]);

  const hasChanges =
    (activeTab === 'upload' && selectedFile !== null) ||
    (activeTab === 'link' && linkInput.trim() !== '');

  const doCancel = useCallback(() => {
    setPreviewLogoUrl(currentLogoUrl);
    setSelectedFile(null);
    setLinkInput('');
    setIsEditingLink(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [currentLogoUrl]);

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      setShowUnsavedDialog(true);
    } else {
      doCancel();
    }
  }, [hasChanges, doCancel]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b bg-background">
        <div className="p-6 pb-0 mb-6">
          <h1 className="text-3xl font-bold">Organization Branding</h1>
          <p className="text-muted-foreground mt-1">
            Manage the visual identity of your workspace across all dashboards, reports, and PDFs
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 mt-6">
        <div className="h-full overflow-y-auto">
          <div className="flex gap-6 max-w-5xl items-stretch bg-white border rounded-lg p-4">
            {/* Left: Upload / Link panel */}
            <div className="flex flex-col gap-4 w-[420px] flex-shrink-0">
              <Tabs
                value={activeTab}
                onValueChange={(v) => {
                  setActiveTab(v as 'upload' | 'link');
                  setIsEditingLink(false);
                  setLinkInput('');
                }}
              >
                <TabsList className="mb-4 h-11 gap-1 p-1 rounded-md">
                  <TabsTrigger
                    value="upload"
                    data-testid="branding-tab-upload"
                    className="px-8 text-sm rounded-sm"
                    disabled={savedLogoSource === 'url'}
                  >
                    Upload
                  </TabsTrigger>
                  <TabsTrigger
                    value="link"
                    data-testid="branding-tab-link"
                    className="px-8 text-sm rounded-sm"
                    disabled={savedLogoSource === 'upload'}
                  >
                    Link
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload">
                  {currentLogoUrl && !selectedFile ? (
                    <>
                      <div
                        className="border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center"
                        style={{ minHeight: '200px' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentLogoUrl}
                          alt="Current logo"
                          className="object-contain max-h-40 p-4"
                        />
                      </div>
                      {currentOrg?.logo_filename && (
                        <p className="text-xs text-gray-500 truncate px-1 mt-2">
                          {currentOrg.logo_filename}
                        </p>
                      )}
                    </>
                  ) : (
                    <div
                      data-testid="branding-dropzone"
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      className="border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-gray-50 transition-colors"
                      style={{ minHeight: '200px' }}
                    >
                      {selectedFile && previewLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewLogoUrl}
                          alt="Logo preview"
                          className="object-contain max-h-40 p-4"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground p-8">
                          <ImageIcon className="h-10 w-10 opacity-40" />
                          <p className="text-sm text-center">
                            Drag and drop your logo here, or click to browse
                          </p>
                          <p className="text-xs">PNG, JPG, WEBP up to 5MB</p>
                        </div>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    id="branding-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleFileInputChange}
                    data-testid="branding-file-input"
                  />
                </TabsContent>

                <TabsContent value="link">
                  <div className="flex flex-col gap-3">
                    <div
                      className="border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center"
                      style={{ minHeight: '200px' }}
                    >
                      {currentLogoUrl && !linkInput.trim() && !isEditingLink ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={currentLogoUrl}
                          alt="Logo"
                          className="object-contain max-h-40 p-4"
                        />
                      ) : linkInput.trim() && previewLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewLogoUrl}
                          alt="Logo preview"
                          className="object-contain max-h-40 p-4"
                          onError={() => setPreviewLogoUrl(null)}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-muted-foreground p-8">
                          <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <Link2 className="h-6 w-6 opacity-50" />
                          </div>
                          <p className="text-sm text-center">Upload your image here</p>
                        </div>
                      )}
                    </div>

                    {currentLogoUrl && !linkInput.trim() && !isEditingLink ? (
                      <p className="text-xs text-gray-500 truncate px-1">{currentLogoUrl}</p>
                    ) : (
                      <input
                        id="branding-logo-url"
                        data-testid="branding-logo-url-input"
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={linkInput}
                        onChange={handleLinkChange}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-primary transition-colors"
                      />
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-3">
                {hasChanges || isEditingLink ? (
                  <>
                    <Button
                      variant="primary"
                      data-testid="branding-save-btn"
                      onClick={handleSave}
                      disabled={isSaving || !hasChanges}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      variant="outline"
                      data-testid="branding-cancel-btn"
                      onClick={handleCancel}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                  </>
                ) : activeTab === 'link' && currentLogoUrl ? (
                  <>
                    <Button
                      variant="primary"
                      data-testid="branding-update-btn"
                      onClick={() => setIsEditingLink(true)}
                    >
                      Update Image
                    </Button>
                    <Button
                      variant="outline"
                      data-testid="branding-remove-btn"
                      onClick={handleRemove}
                      disabled={isRemoving}
                      className="border-gray-400 text-gray-800 hover:bg-gray-100"
                    >
                      {isRemoving ? 'Removing...' : 'Remove'}
                    </Button>
                  </>
                ) : activeTab === 'upload' && currentLogoUrl ? (
                  <>
                    <Button
                      variant="primary"
                      data-testid="branding-update-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Update Image
                    </Button>
                    <Button
                      variant="outline"
                      data-testid="branding-remove-btn"
                      onClick={handleRemove}
                      disabled={isRemoving}
                      className="border-gray-400 text-gray-800 hover:bg-gray-100"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {isRemoving ? 'Removing...' : 'Remove'}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            {/* Right: Dashboard preview */}
            <div className="flex-1 flex min-h-[320px]">
              <BrandingPreview logoUrl={previewLogoUrl ?? currentLogoUrl} />
            </div>
          </div>
        </div>
      </div>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onConfirm={doCancel}
      />
    </div>
  );
}
