'use client';

import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Allow only safe inline HTML tags from Airbyte spec descriptions
const ALLOWED_TAGS = ['a', 'b', 'i', 'em', 'strong', 'code', 'br', 'ul', 'li', 'ol', 'p'];

function sanitizeHtml(html: string): string {
  // Strip all tags except allowed ones
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
    if (ALLOWED_TAGS.includes(tag.toLowerCase())) {
      // For anchor tags, ensure they open in new tab and have noopener
      if (tag.toLowerCase() === 'a') {
        return match
          .replace(/>$/, ' target="_blank" rel="noopener noreferrer">')
          .replace(/ target="[^"]*"/g, ' target="_blank"')
          .replace(/ rel="[^"]*"/g, ' rel="noopener noreferrer"');
      }
      return match;
    }
    return '';
  });
}

interface FieldLabelProps {
  title: string;
  required: boolean;
  description?: string;
  htmlFor?: string;
}

export function FieldLabel({ title, required, description, htmlFor }: FieldLabelProps) {
  const sanitizedDescription = useMemo(
    () => (description ? sanitizeHtml(description) : ''),
    [description]
  );

  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <label htmlFor={htmlFor} className="text-[15px] font-medium">
        {title}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {description && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info
                className="h-3.5 w-3.5 text-muted-foreground cursor-help"
                data-testid={`field-info-${htmlFor}`}
              />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-xs">
              <p dangerouslySetInnerHTML={{ __html: sanitizedDescription }} />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
