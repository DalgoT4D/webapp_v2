import { Suspense } from 'react';
import { PrivateEmbedDashboardView } from './PrivateEmbedDashboardView';

interface PrivateEmbedDashboardPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PrivateEmbedDashboardPage({
  params,
  searchParams,
}: PrivateEmbedDashboardPageProps) {
  const { token } = await params;
  const {
    embed = 'true',
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
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      }
    >
      <PrivateEmbedDashboardView token={token} embedOptions={embedOptions} />
    </Suspense>
  );
}
