'use client';

import React, { useState, useEffect } from 'react';
import { toastSuccess, toastError } from '@/lib/toast';
import {
  Share2,
  Copy,
  Shield,
  AlertTriangle,
  Lock,
  Plus,
  Clock,
  Eye,
  Trash2,
  RefreshCw,
  Code,
  Check,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { updateDashboardSharing, getDashboardSharingStatus } from '@/hooks/api/useDashboards';
import type { Dashboard } from '@/hooks/api/useDashboards';
import type { EmbedToken, CreateEmbedTokenRequest } from '@/types/embed-tokens';

interface ShareModalProps {
  dashboard: Dashboard;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void; // Callback to refresh dashboard data
}

interface ShareStatus {
  is_public: boolean;
  public_url?: string;
  public_access_count: number;
  last_public_accessed?: string;
  public_shared_at?: string;
}

interface PrivateEmbedCodeDropdownProps {
  token: string;
  dashboardTitle: string;
  onCopyCode: (token: string) => void;
  isCopied: boolean;
}

function PrivateEmbedCodeDropdown({
  token,
  dashboardTitle,
  onCopyCode,
  isCopied,
}: PrivateEmbedCodeDropdownProps) {
  const [embedOptions, setEmbedOptions] = useState({
    showTitle: true,
    showOrganization: true,
    theme: 'light' as 'light' | 'dark',
    showPadding: true,
    width: 800,
    height: 600,
  });

  const generateEmbedCode = () => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      embed: 'true',
      title: embedOptions.showTitle.toString(),
      org: embedOptions.showOrganization.toString(),
      theme: embedOptions.theme,
      padding: embedOptions.showPadding.toString(),
    });

    const embedUrl = `${baseUrl}/embed/private/dashboard/${token}?${params.toString()}`;

    return `<!-- Private dashboard embed with secure token -->
<iframe
  src="${embedUrl}"
  width="${embedOptions.width}"
  height="${embedOptions.height}"
  frameborder="0"
  allowfullscreen
  title="${dashboardTitle}"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
></iframe>`;
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generateEmbedCode());
      onCopyCode(token);
    } catch (error) {
      console.error('Failed to copy embed code:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Generate embed code">
          <Code className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-4">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-3">Private Embed Code</h3>

            {/* Embed Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Show title</Label>
                <Switch
                  checked={embedOptions.showTitle}
                  onCheckedChange={(checked) =>
                    setEmbedOptions((prev) => ({ ...prev, showTitle: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Show organization</Label>
                <Switch
                  checked={embedOptions.showOrganization}
                  onCheckedChange={(checked) =>
                    setEmbedOptions((prev) => ({ ...prev, showOrganization: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Show padding</Label>
                <Switch
                  checked={embedOptions.showPadding}
                  onCheckedChange={(checked) =>
                    setEmbedOptions((prev) => ({ ...prev, showPadding: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Theme</Label>
                <select
                  value={embedOptions.theme}
                  onChange={(e) =>
                    setEmbedOptions((prev) => ({
                      ...prev,
                      theme: e.target.value as 'light' | 'dark',
                    }))
                  }
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-gray-600">Width</Label>
                  <input
                    type="number"
                    value={embedOptions.width}
                    onChange={(e) =>
                      setEmbedOptions((prev) => ({
                        ...prev,
                        width: parseInt(e.target.value) || 800,
                      }))
                    }
                    className="w-full text-sm border rounded px-2 py-1 mt-1"
                    min="300"
                    max="1200"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Height</Label>
                  <input
                    type="number"
                    value={embedOptions.height}
                    onChange={(e) =>
                      setEmbedOptions((prev) => ({
                        ...prev,
                        height: parseInt(e.target.value) || 600,
                      }))
                    }
                    className="w-full text-sm border rounded px-2 py-1 mt-1"
                    min="300"
                    max="1000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Generated Code */}
          <div className="space-y-2">
            <Label className="text-sm">Embed Code</Label>
            <textarea
              value={generateEmbedCode()}
              readOnly
              className="w-full text-xs font-mono p-2 border rounded bg-gray-50 resize-none"
              rows={5}
            />
            <Button
              onClick={handleCopyCode}
              variant={isCopied ? 'default' : 'outline'}
              size="sm"
              className="w-full"
            >
              {isCopied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Embed Code
                </>
              )}
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ShareModal({ dashboard, isOpen, onClose, onUpdate }: ShareModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus>({
    is_public: dashboard.is_public,
    public_access_count: dashboard.public_access_count,
  });

  // Private embed tokens state
  const [embedTokens, setEmbedTokens] = useState<EmbedToken[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [showCreateTokenForm, setShowCreateTokenForm] = useState(false);
  const [newTokenDays, setNewTokenDays] = useState(30);
  const [embedCodeCopied, setEmbedCodeCopied] = useState<string | null>(null);

  // Fetch current share status and embed tokens when modal opens
  useEffect(() => {
    if (isOpen && dashboard.id) {
      fetchShareStatus();
      fetchEmbedTokens();
    }
  }, [isOpen, dashboard.id]);

  const fetchShareStatus = async () => {
    try {
      const status = await getDashboardSharingStatus(dashboard.id);
      setShareStatus(status);
    } catch (error) {
      console.error('Failed to fetch share status:', error);
      toastError.load(error, 'sharing status');
    }
  };

  const fetchEmbedTokens = async () => {
    setIsLoadingTokens(true);
    try {
      const response = await fetch(`/api/dashboards/${dashboard.id}/embed-tokens`);
      if (!response.ok) {
        throw new Error('Failed to fetch embed tokens');
      }
      const data = await response.json();
      setEmbedTokens(data.tokens || []);
    } catch (error) {
      console.error('Failed to fetch embed tokens:', error);
      toastError.api(error, 'Failed to load embed tokens');
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const createEmbedToken = async () => {
    setIsCreatingToken(true);
    try {
      const request: CreateEmbedTokenRequest = {
        dashboard_id: dashboard.id,
        expires_in_days: newTokenDays,
      };

      const response = await fetch(`/api/dashboards/${dashboard.id}/embed-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error('Failed to create embed token');
      }

      const data = await response.json();
      await navigator.clipboard.writeText(data.embed_url);
      toastSuccess.generic('Embed token created and URL copied to clipboard!');

      setShowCreateTokenForm(false);
      await fetchEmbedTokens(); // Refresh the list
    } catch (error) {
      console.error('Failed to create embed token:', error);
      toastError.api(error, 'Failed to create embed token');
    } finally {
      setIsCreatingToken(false);
    }
  };

  const extendToken = async (tokenId: string, days: number) => {
    try {
      const response = await fetch(`/api/embed-tokens/${tokenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extend_days: days }),
      });

      if (!response.ok) {
        throw new Error('Failed to extend token');
      }

      toastSuccess.generic(`Token extended by ${days} days`);
      await fetchEmbedTokens(); // Refresh the list
    } catch (error) {
      console.error('Failed to extend token:', error);
      toastError.api(error, 'Failed to extend token');
    }
  };

  const revokeToken = async (tokenId: string) => {
    try {
      const response = await fetch(`/api/embed-tokens/${tokenId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke token');
      }

      toastSuccess.generic('Token revoked successfully');
      await fetchEmbedTokens(); // Refresh the list
    } catch (error) {
      console.error('Failed to revoke token:', error);
      toastError.api(error, 'Failed to revoke token');
    }
  };

  const copyEmbedUrl = async (token: string) => {
    try {
      const baseUrl = window.location.origin;
      const embedUrl = `${baseUrl}/embed/private/dashboard/${token}`;
      await navigator.clipboard.writeText(embedUrl);
      toastSuccess.generic('Embed URL copied to clipboard!');
    } catch (error) {
      toastError.api(error, 'Failed to copy URL');
    }
  };

  const generatePrivateEmbedCode = (
    token: string,
    options = {
      showTitle: true,
      showOrganization: true,
      theme: 'light' as 'light' | 'dark',
      showPadding: true,
      width: 800,
      height: 600,
    }
  ) => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      embed: 'true',
      title: options.showTitle.toString(),
      org: options.showOrganization.toString(),
      theme: options.theme,
      padding: options.showPadding.toString(),
    });

    const embedUrl = `${baseUrl}/embed/private/dashboard/${token}?${params.toString()}`;

    return `<!-- Private dashboard embed with secure token -->
<iframe
  src="${embedUrl}"
  width="${options.width}"
  height="${options.height}"
  frameborder="0"
  allowfullscreen
  title="${dashboard.title}"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
></iframe>`;
  };

  const copyPrivateEmbedCode = async (token: string) => {
    try {
      const embedCode = generatePrivateEmbedCode(token);
      await navigator.clipboard.writeText(embedCode);
      setEmbedCodeCopied(token);
      setTimeout(() => setEmbedCodeCopied(null), 2000);
      toastSuccess.generic('Embed code copied to clipboard!');
    } catch (error) {
      toastError.api(error, 'Failed to copy embed code');
    }
  };

  const handleToggleSharing = async (isPublic: boolean) => {
    setIsLoading(true);

    try {
      const response = await updateDashboardSharing(dashboard.id, { is_public: isPublic });

      // Update local state
      setShareStatus((prev) => ({
        ...prev,
        is_public: response.is_public,
        public_url: response.public_url,
      }));

      if (isPublic && response.public_url) {
        // Copy URL to clipboard
        await navigator.clipboard.writeText(response.public_url);
        toastSuccess.generic('Dashboard made public and URL copied to clipboard!');
      } else {
        toastSuccess.generic('Dashboard sharing disabled');
      }

      // Refresh parent component
      onUpdate();
    } catch (error: any) {
      console.error('Failed to toggle sharing:', error);
      toastError.share(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    if (shareStatus.public_url) {
      try {
        await navigator.clipboard.writeText(shareStatus.public_url);
        toastSuccess.generic('URL copied to clipboard!');
      } catch (error) {
        toastError.api(error, 'Failed to copy URL');
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Dashboard
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Organization Access (Default) */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <div>
                    <Label className="text-sm font-medium">Organization Access</Label>
                    <p className="text-xs text-muted-foreground">
                      Users in your organization with proper permissions can access this dashboard
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Default</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Public Sharing Toggle */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Share2 className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Public Access</Label>
                      <p className="text-xs text-muted-foreground">
                        Anyone with the link can view this dashboard
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={shareStatus.is_public}
                    onCheckedChange={handleToggleSharing}
                    disabled={isLoading}
                  />
                </div>

                {/* Security Warning */}
                {shareStatus.is_public && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-orange-800">
                      <strong>Security Notice:</strong> Your data is now exposed to the internet.
                      Anyone with this link can access your dashboard data without authentication.
                    </div>
                  </div>
                )}

                {/* Copy URL Button */}
                {shareStatus.is_public && shareStatus.public_url && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Share this dashboard:</Label>
                    <Button variant="outline" onClick={handleCopyUrl} className="w-full">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Public Link
                    </Button>
                  </div>
                )}

                {/* Analytics */}
                {shareStatus.is_public && shareStatus.public_access_count > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <p>Public access count: {shareStatus.public_access_count}</p>
                    {shareStatus.last_public_accessed && (
                      <p>
                        Last accessed: {new Date(shareStatus.last_public_accessed).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Private Embed Tokens */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-purple-600" />
                    <div>
                      <Label className="text-sm font-medium">Private Embed Access</Label>
                      <p className="text-xs text-muted-foreground">
                        Generate secure, temporary tokens for embedding private dashboards
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateTokenForm(!showCreateTokenForm)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    New Token
                  </Button>
                </div>

                {/* Create Token Form */}
                {showCreateTokenForm && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-md space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label className="text-xs font-medium">Expires in (days)</Label>
                        <input
                          type="number"
                          value={newTokenDays}
                          onChange={(e) => setNewTokenDays(parseInt(e.target.value) || 30)}
                          className="w-full text-sm border rounded px-2 py-1 mt-1"
                          min="1"
                          max="365"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={createEmbedToken}
                          disabled={isCreatingToken}
                          className="gap-2"
                        >
                          {isCreatingToken ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                          Create
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCreateTokenForm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tokens List */}
                <div className="space-y-2">
                  {isLoadingTokens ? (
                    <div className="text-center py-4">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                      <p className="text-xs text-muted-foreground mt-1">Loading tokens...</p>
                    </div>
                  ) : embedTokens.length === 0 ? (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      No private embed tokens created yet
                    </div>
                  ) : (
                    embedTokens.map((token) => (
                      <div
                        key={token.id}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant={token.is_active ? 'default' : 'secondary'}>
                              {token.is_active ? 'Active' : 'Expired'}
                            </Badge>
                            {token.time_until_expiry && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{token.time_until_expiry}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Eye className="h-3 w-3" />
                              <span>{token.view_count} views</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Created: {new Date(token.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <PrivateEmbedCodeDropdown
                            token={token.token}
                            dashboardTitle={dashboard.title}
                            onCopyCode={() => {
                              setEmbedCodeCopied(token.token);
                              setTimeout(() => setEmbedCodeCopied(null), 2000);
                              toastSuccess.generic('Embed code copied to clipboard!');
                            }}
                            isCopied={embedCodeCopied === token.token}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyEmbedUrl(token.token)}
                            className="h-8 w-8 p-0"
                            title="Copy embed URL"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => extendToken(token.id, 30)}
                            className="h-8 w-8 p-0"
                            title="Extend by 30 days"
                            disabled={!token.is_active}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeToken(token.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            title="Revoke token"
                            disabled={!token.is_active}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Info Box */}
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800">
                    <strong>Secure Embedding:</strong> Private embed tokens allow you to share
                    dashboards without making them publicly accessible. Tokens can be extended or
                    revoked at any time for enhanced security.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
