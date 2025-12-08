'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock } from 'lucide-react';

interface PermissionDeniedProps {
  message?: string;
  backUrl?: string;
  backLabel?: string;
}

export function PermissionDenied({
  message = "You don't have permission to view charts.",
  backUrl = '/charts',
  backLabel = 'Back to Charts',
}: PermissionDeniedProps) {
  const router = useRouter();

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">{message}</p>
        <Button variant="outline" onClick={() => router.push(backUrl)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {backLabel}
        </Button>
      </div>
    </div>
  );
}
