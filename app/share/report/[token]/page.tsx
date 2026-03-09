import { Suspense } from 'react';
import { PublicReportView } from './PublicReportView';

interface PublicReportPageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicReportPage({ params }: PublicReportPageProps) {
  const { token } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading report...</p>
            </div>
          </div>
        }
      >
        <PublicReportView token={token} />
      </Suspense>
    </div>
  );
}
