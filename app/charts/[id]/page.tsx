import { ChartDetailClient } from './ChartDetailClient';

interface ChartPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ChartPage({ params }: ChartPageProps) {
  const { id } = await params;
  const chartId = parseInt(id);

  return <ChartDetailClient chartId={chartId} />;
}
