'use client';

import { useState, type ReactNode } from 'react';
import { Edit, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownPreview } from '@/components/settings/markdown-preview';

interface MarkdownContextEditorCardProps {
  title: string;
  description: string;
  markdown: string;
  onMarkdownChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  isSaving: boolean;
  updatedBy: string;
  updatedAt: string;
  saveLabel: string;
  placeholder: string;
  emptyPreviewMessage: string;
  controls?: ReactNode;
  disabled?: boolean;
}

export function MarkdownContextEditorCard({
  title,
  description,
  markdown,
  onMarkdownChange,
  onSave,
  isSaving,
  updatedBy,
  updatedAt,
  saveLabel,
  placeholder,
  emptyPreviewMessage,
  controls,
  disabled = false,
}: MarkdownContextEditorCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {controls}

        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing((currentValue) => !currentValue)}
              disabled={disabled || isSaving}
              aria-label={isEditing ? 'Show preview' : 'Edit context'}
            >
              {isEditing ? <Eye className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
              {isEditing ? 'Preview' : 'Edit'}
            </Button>
          </div>

          {isEditing ? (
            <Textarea
              value={markdown}
              onChange={(event) => onMarkdownChange(event.target.value)}
              className="min-h-64"
              placeholder={placeholder}
              disabled={disabled}
            />
          ) : (
            <div className="min-h-64 rounded-md border bg-slate-50 p-4">
              <MarkdownPreview markdown={markdown} emptyMessage={emptyPreviewMessage} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Last updated by {updatedBy} on {updatedAt}.
          </div>
          {isEditing ? (
            <Button onClick={onSave} disabled={isSaving || disabled}>
              {isSaving ? 'Saving...' : saveLabel}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
