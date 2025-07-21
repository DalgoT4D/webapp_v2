import { IndividualDashboardView } from '@/components/dashboard/individual-dashboard-view';

export default async function IndividualDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IndividualDashboardView dashboardId={id} />;
}
