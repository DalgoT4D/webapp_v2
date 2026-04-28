'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AnimatedBackgroundSimple } from '@/components/ui/animated-background-simple';
import Image from 'next/image';

function MigrationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectPath = searchParams.get('redirect') || '/';

  const handleContinue = () => {
    router.push(redirectPath);
  };

  return (
    <AnimatedBackgroundSimple>
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md space-y-6 rounded-lg bg-white/95 backdrop-blur-sm p-8 shadow-lg border border-white/20">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <Image
                src="/dalgo_logo.svg"
                alt="Dalgo"
                width={80}
                height={90}
                className="text-primary"
              />
            </div>
            <h1 className="text-2xl font-bold mb-2">Welcome to Dalgo V2</h1>
            <p className="text-gray-600">
              We have upgraded to a new and improved experience. The old dashboard domain is no
              longer active. Dalgo V2 shifts the focus from data pipelines and ETL to what matters
              most — charts, dashboards, reports, and actionable insights.
            </p>
          </div>

          <Button data-testid="migration-continue-btn" className="w-full" onClick={handleContinue}>
            Continue to Dalgo v2
          </Button>
        </div>
      </div>
    </AnimatedBackgroundSimple>
  );
}

export default function MigrationPage() {
  return (
    <Suspense
      fallback={
        <AnimatedBackgroundSimple>
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg font-medium text-white">Loading...</p>
            </div>
          </div>
        </AnimatedBackgroundSimple>
      }
    >
      <MigrationContent />
    </Suspense>
  );
}
