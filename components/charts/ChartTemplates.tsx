'use client';

import React, { useState } from 'react';
import { useChartTemplates } from '@/hooks/api/useChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChartTemplate } from '@/hooks/api/useChart';

interface ChartTemplatesProps {
  onTemplateSelect: (template: ChartTemplate) => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
}

export default function ChartTemplates({
  onTemplateSelect,
  selectedCategory = 'all',
  onCategoryChange,
}: ChartTemplatesProps) {
  const { data: templates, isLoading, error } = useChartTemplates();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter templates based on category and search term
  const filteredTemplates =
    templates?.filter((template) => {
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
      const matchesSearch =
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    }) || [];

  // Get unique categories from templates
  const categories = templates ? ['all', ...new Set(templates.map((t) => t.category))] : ['all'];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Failed to load chart templates</p>
        <p className="text-sm text-gray-500 mt-2">Please try again later</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Category Filter */}
      <div className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCategoryChange?.(category)}
              className="capitalize"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No templates found</p>
          <p className="text-sm text-gray-400 mt-2">Try adjusting your search or category filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="mt-1">{template.description}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {template.chart_type}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Preview Image */}
                {template.preview_image && (
                  <div className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={template.preview_image}
                      alt={template.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Data Requirements */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Data Requirements:</p>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline">
                      {template.config_template.data_requirements.dimensions} dimension(s)
                    </Badge>
                    <Badge variant="outline">
                      {template.config_template.data_requirements.metrics} metric(s)
                    </Badge>
                  </div>
                </div>

                {/* Use Template Button */}
                <Button className="w-full" onClick={() => onTemplateSelect(template)} size="sm">
                  Use Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
