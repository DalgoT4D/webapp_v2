'use client';

import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div data-testid="not-found" className="h-full flex items-center justify-center bg-muted/30">
      <div className="text-center max-w-md">
        <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
          <FileQuestion className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Page not found</h2>
        <p className="text-muted-foreground mb-4">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/">
          <Button variant="primary">Back to home</Button>
        </Link>
      </div>
    </div>
  );
}
