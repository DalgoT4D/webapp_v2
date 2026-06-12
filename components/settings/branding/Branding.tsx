'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TriangleAlert, Trash2 } from 'lucide-react';
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
import { isValidHttpUrl } from '@/lib/utils';
import { toastError } from '@/lib/toast';
import { useBranding } from '@/hooks/useBranding';
import { UploadTabContent } from './branding-upload-tab';
import { LinkTabContent } from './branding-link-tab';

// Must match MAX_FILE_SIZE_BYTES in DDP_backend/ddpui/utils/s3_utils.py
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

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
  const { currentOrg, currentLogoUrl, savedLogoSource, isSaving, isRemoving, save, remove } =
    useBranding();

  const [activeTab, setActiveTab] = useState<'upload' | 'link'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync active tab when org switches and has an existing logo
  useEffect(() => {
    if (savedLogoSource) setActiveTab(savedLogoSource === 'upload' ? 'upload' : 'link');
  }, [savedLogoSource]);

  // Blob URL lifecycle: create when a file is selected, revoke on change or unmount
  useEffect(() => {
    if (!selectedFile) return undefined;
    const url = URL.createObjectURL(selectedFile);
    setUploadPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setUploadPreviewUrl(null);
    };
  }, [selectedFile]);

  // Auto-focus the URL input when edit mode is entered
  useEffect(() => {
    if (isEditingLink) {
      document.getElementById('branding-logo-url')?.focus();
    }
  }, [isEditingLink]);

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

  const hasChanges =
    (activeTab === 'upload' && selectedFile !== null) ||
    (activeTab === 'link' &&
      linkInput.trim() !== '' &&
      linkInput.trim() !== (currentLogoUrl ?? ''));

  const doCancel = useCallback(() => {
    setSelectedFile(null);
    setLinkInput('');
    setIsEditingLink(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      setShowUnsavedDialog(true);
    } else {
      doCancel();
    }
  }, [hasChanges, doCancel]);

  const handleSave = useCallback(async () => {
    const ok = await save(activeTab, selectedFile, linkInput);
    if (ok) doCancel();
  }, [save, activeTab, selectedFile, linkInput, doCancel]);

  const handleRemove = useCallback(async () => {
    await remove();
  }, [remove]);

  const previewLogoUrl =
    activeTab === 'upload'
      ? (uploadPreviewUrl ?? currentLogoUrl)
      : isValidHttpUrl(linkInput.trim())
        ? linkInput.trim()
        : isEditingLink
          ? null
          : currentLogoUrl;

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
                  <UploadTabContent
                    currentLogoUrl={currentLogoUrl}
                    selectedFile={selectedFile}
                    uploadPreviewUrl={uploadPreviewUrl}
                    logoFilename={currentOrg?.logo_filename}
                    fileInputRef={fileInputRef}
                    onFileInputChange={handleFileInputChange}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  />
                </TabsContent>

                <TabsContent value="link">
                  <LinkTabContent
                    currentLogoUrl={currentLogoUrl}
                    linkInput={linkInput}
                    isEditingLink={isEditingLink}
                    onLinkChange={setLinkInput}
                  />
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
                      onClick={() => {
                        setLinkInput(currentLogoUrl ?? '');
                        setIsEditingLink(true);
                      }}
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
              <BrandingPreview logoUrl={previewLogoUrl} />
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
