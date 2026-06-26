'use client';

import { useState } from 'react';
import { Code, Copy, Check } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface EmbedCodeDropdownProps {
  token: string;
  dashboardTitle: string;
}

export function EmbedCodeDropdown({ token, dashboardTitle }: EmbedCodeDropdownProps) {
  const [copied, setCopied] = useState(false);
  const [embedOptions, setEmbedOptions] = useState({
    showTitle: true,
    showOrganization: true,
    theme: 'light' as 'light' | 'dark',
    showPadding: true,
    width: 800,
    height: 600,
  });

  const generateEmbedCode = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams({
      embed: 'true',
      title: embedOptions.showTitle.toString(),
      org: embedOptions.showOrganization.toString(),
      theme: embedOptions.theme,
      padding: embedOptions.showPadding.toString(),
    });
    const embedUrl = `${baseUrl}/share/dashboard/${token}?${params.toString()}`;
    return `<!-- allow-popups permission enables the "Powered by Dalgo" link to open in a new tab -->
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_EMBED_CODE_COPIED, { theme: embedOptions.theme });
    } catch (error) {
      console.error('Failed to copy embed code:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="p-1.5">
          <Code className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-4">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-3">Embed Dashboard</h3>
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
              variant={copied ? 'default' : 'outline'}
              size="sm"
              className="w-full"
            >
              {copied ? (
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
