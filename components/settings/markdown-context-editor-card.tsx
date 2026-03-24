'use client';

import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {controls}

        <Tabs defaultValue="edit" className="w-full">
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="edit">
            <Textarea
              value={markdown}
              onChange={(event) => onMarkdownChange(event.target.value)}
              className="min-h-64"
              placeholder={placeholder}
              disabled={disabled}
            />
          </TabsContent>
          <TabsContent value="preview">
            <div className="min-h-64 rounded-md border bg-slate-50 p-4">
              <MarkdownPreview markdown={markdown} emptyMessage={emptyPreviewMessage} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Last updated by {updatedBy} on {updatedAt}.
          </div>
          <Button onClick={onSave} disabled={isSaving || disabled}>
            {isSaving ? 'Saving...' : saveLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
