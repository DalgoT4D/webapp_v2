'use client';

import { useState, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, Share2, Download, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardElementData } from './dashboard-builder';
import { ChartElement } from './chart-element';
import { TextElement } from './text-element';
import { HeadingElement } from './heading-element';

interface IndividualDashboardViewProps {
  dashboardId: string;
}

interface Dashboard {
  id: string;
  title: string;
  description?: string;
  elements: DashboardElementData[];
  createdAt: string;
  updatedAt: string;
  author: string;
  isPublic: boolean;
  tags: string[];
}

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <h2 className="text-base font-bold text-red-800">Dashboard Error:</h2>
      <p className="text-sm text-red-600">{error.message}</p>
    </div>
  );
}

export function IndividualDashboardView({ dashboardId }: IndividualDashboardViewProps) {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setIsLoading(true);
        setError(null);

        // TODO: Replace with actual API call
        // const response = await fetch(`/api/dashboards/${dashboardId}`);
        // if (!response.ok) throw new Error('Failed to fetch dashboard');
        // const data = await response.json();

        // Mock data for now
        const mockDashboard: Dashboard = {
          id: dashboardId,
          title: 'Sample Dashboard',
          description: 'This is a sample dashboard with various elements',
          elements: [
            {
              id: 'element-1',
              type: 'heading',
              position: { x: 0, y: 0 },
              size: { width: 600, height: 80 },
              gridSize: { cols: 3, rows: 1 },
              config: {
                text: 'Dashboard Overview',
                level: 1,
                color: '#1a365d',
              },
              title: 'Main Heading',
            },
            {
              id: 'element-2',
              type: 'chart',
              position: { x: 0, y: 100 },
              size: { width: 400, height: 300 },
              gridSize: { cols: 2, rows: 2 },
              config: {
                chartType: 'bar',
                data: [
                  { name: 'Jan', value: 100 },
                  { name: 'Feb', value: 120 },
                  { name: 'Mar', value: 90 },
                  { name: 'Apr', value: 150 },
                  { name: 'May', value: 110 },
                  { name: 'Jun', value: 180 },
                ],
                xKey: 'name',
                yKey: 'value',
                title: 'Monthly Performance',
              },
              title: 'Performance Chart',
            },
            {
              id: 'element-3',
              type: 'text',
              position: { x: 420, y: 100 },
              size: { width: 300, height: 200 },
              gridSize: { cols: 1, rows: 1 },
              config: {
                content:
                  'This dashboard shows key performance indicators and metrics for the current quarter. The data is updated in real-time to provide the most current insights.',
                fontSize: 14,
                fontWeight: 'normal',
                color: '#4a5568',
              },
              title: 'Description',
            },
          ],
          createdAt: '2024-01-15T10:30:00Z',
          updatedAt: '2024-01-20T14:20:00Z',
          author: 'John Doe',
          isPublic: true,
          tags: ['analytics', 'performance', 'quarterly'],
        };

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        setDashboard(mockDashboard);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboard();
  }, [dashboardId]);

  const handleEdit = () => {
    router.push(`/dashboards/${dashboardId}/edit`);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      // TODO: Show success toast
      console.log('Dashboard link copied to clipboard');
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleDownload = () => {
    // TODO: Implement dashboard export functionality
    console.log('Download dashboard');
  };

  const renderElement = (element: DashboardElementData) => {
    const commonProps = {
      element,
      isSelected: false,
      onSelect: () => {},
      onUpdate: () => {},
      onDelete: () => {},
    };

    switch (element.type) {
      case 'chart':
        return <ChartElement key={element.id} {...commonProps} />;
      case 'text':
        return <TextElement key={element.id} {...commonProps} />;
      case 'heading':
        return <HeadingElement key={element.id} {...commonProps} />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h2>
          <p className="text-red-600">{error}</p>
          <Button variant="outline" onClick={() => router.push('/dashboards')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboards
          </Button>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Dashboard not found</p>
          <Button variant="outline" onClick={() => router.push('/dashboards')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboards
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => router.push('/dashboards')} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboards
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="default" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{dashboard.title}</h1>
          {dashboard.description && (
            <p className="text-muted-foreground text-lg">{dashboard.description}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Created by {dashboard.author}</span>
            <span>•</span>
            <span>Updated {new Date(dashboard.updatedAt).toLocaleDateString()}</span>
            {dashboard.isPublic && (
              <>
                <span>•</span>
                <Badge variant="secondary">Public</Badge>
              </>
            )}
          </div>

          {dashboard.tags.length > 0 && (
            <div className="flex gap-2 mt-2">
              {dashboard.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dashboard Content */}
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <div className="space-y-6">
          {dashboard.elements.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">This dashboard is empty</p>
                  <Button onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Add Elements
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">{dashboard.elements.map(renderElement)}</div>
          )}
        </div>
      </ErrorBoundary>
    </div>
  );
}
