import { Suspense } from 'react';
import { PublicDashboardView } from './PublicDashboardView';

interface PublicDashboardPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PublicDashboardPage({
  params,
  searchParams,
}: PublicDashboardPageProps) {
  const { token } = await params;
  const {
    embed,
    title = 'true',
    org = 'true',
    theme = 'light',
    padding = 'true',
  } = await searchParams;

  const embedOptions = {
    showTitle: title === 'true',
    showOrganization: org === 'true',
    theme: theme as 'light' | 'dark',
    showPadding: padding === 'true',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading dashboard...</p>
            </div>
          </div>
        }
      >
        <PublicDashboardView
          token={token}
          isEmbedMode={embed === 'true'}
          embedOptions={embed === 'true' ? embedOptions : undefined}
        />
      </Suspense>
    </div>
  );
}
