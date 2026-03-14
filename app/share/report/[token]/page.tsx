import { Suspense } from 'react';
import { PublicReportView } from './PublicReportView';

interface PublicReportPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ print?: string }>;
}

export default async function PublicReportPage({ params, searchParams }: PublicReportPageProps) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const printMode = resolvedSearchParams?.print === 'true';

  return (
    <div className={printMode ? 'bg-white' : 'min-h-screen bg-gray-50'}>
      <Suspense
        fallback={
          printMode ? null : (
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading report...</p>
              </div>
            </div>
          )
        }
      >
        <PublicReportView token={token} printMode={printMode} />
      </Suspense>
    </div>
  );
}
