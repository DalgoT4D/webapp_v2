'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Heart,
  Download,
  Eye,
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
} from 'lucide-react';
import { useCharts, useChartDelete, useChartFavorite } from '@/hooks/api/useChart';
import { formatDistanceToNow } from 'date-fns';

export default function ChartsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // API hooks
  const { data: charts, isLoading, error, mutate } = useCharts();

  const { delete: deleteChart } = useChartDelete();
  const { toggleFavorite } = useChartFavorite();

  // Handle chart deletion
  const handleDelete = async (chartId: number) => {
    if (confirm('Are you sure you want to delete this chart?')) {
      try {
        await deleteChart(chartId);
        mutate(); // Refresh the charts list
      } catch (error) {
        console.error('Error deleting chart:', error);
      }
    }
  };

  // Handle favorite toggle
  const handleFavorite = async (chartId: number) => {
    try {
      await toggleFavorite(chartId);
      mutate(); // Refresh the charts list
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Filter charts based on search and filters
  const filteredCharts = React.useMemo(() => {
    if (!charts) return [];

    return charts.filter((chart: any) => {
      const matchesSearch =
        chart.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chart.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = filterType === 'all' || chart.chart_type === filterType;

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'public' && chart.is_public) ||
        (filterStatus === 'private' && !chart.is_public) ||
        (filterStatus === 'favorite' && chart.is_favorite);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [charts, searchTerm, filterType, filterStatus]);

  // Chart type icons
  const getChartIcon = (config: any) => {
    const chartType = config?.chartType || 'bar';
    switch (chartType) {
      case 'line':
        return <LineChart className="h-4 w-4" />;
      case 'pie':
        return <PieChart className="h-4 w-4" />;
      default:
        return <BarChart3 className="h-4 w-4" />;
    }
  };

  // Chart type label
  const getChartTypeLabel = (config: any) => {
    const chartType = config?.chartType || 'bar';
    return chartType.charAt(0).toUpperCase() + chartType.slice(1);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error loading charts</h2>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Charts</h1>
          <p className="text-gray-600 mt-1">Create and manage your data visualizations</p>
        </div>
        <Link href="/charts/builder">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Chart
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search charts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="bar">Bar Charts</SelectItem>
            <SelectItem value="line">Line Charts</SelectItem>
            <SelectItem value="pie">Pie Charts</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Charts</SelectItem>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="private">Private</SelectItem>
            <SelectItem value="favorite">Favorites</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Charts Grid */}
      {filteredCharts.length === 0 ? (
        <div className="text-center py-12">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || filterType !== 'all' || filterStatus !== 'all'
              ? 'No charts match your filters'
              : 'No charts created yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || filterType !== 'all' || filterStatus !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first chart to get started with data visualization'}
          </p>
          <Link href="/charts/builder">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Chart
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCharts.map((chart: any) => (
            <Card key={chart.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-50 rounded-lg">{getChartIcon(chart.config)}</div>
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-1">{chart.title}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {chart.description || 'No description'}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleFavorite(chart.id)}>
                        <Heart
                          className={`h-4 w-4 mr-2 ${chart.is_favorite ? 'text-red-500' : ''}`}
                        />
                        {chart.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(chart.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">{getChartTypeLabel(chart.config)}</Badge>
                    {chart.is_public && <Badge variant="outline">Public</Badge>}
                    {chart.is_favorite && (
                      <Badge variant="outline" className="text-red-600 border-red-200">
                        <Heart className="h-3 w-3 mr-1" />
                        Favorite
                      </Badge>
                    )}
                  </div>

                  <div className="text-sm text-gray-600">
                    <p>
                      <strong>Source:</strong> {chart.schema_name}.{chart.table}
                    </p>
                    <p>
                      <strong>Created:</strong>{' '}
                      {formatDistanceToNow(new Date(chart.created_at), { addSuffix: true })}
                    </p>
                    <p>
                      <strong>By:</strong> {chart.created_by?.user.first_name}{' '}
                      {chart.created_by?.user.last_name}
                    </p>
                  </div>

                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
