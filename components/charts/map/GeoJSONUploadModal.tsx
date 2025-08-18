'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRegions } from '@/hooks/api/useChart';
import { apiPost } from '@/lib/api';
import { toast } from 'sonner';

interface GeoJSONUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  countryCode?: string;
}

export function GeoJSONUploadModal({
  isOpen,
  onClose,
  onSuccess,
  countryCode = 'IND',
}: GeoJSONUploadModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    regionId: '',
    name: '',
    description: '',
    propertiesKey: '',
    geojsonData: '',
  });

  // Fetch available regions for the selected country
  const { data: regions } = useRegions(countryCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.regionId || !formData.name || !formData.propertiesKey || !formData.geojsonData) {
      toast.error('Please fill in all required fields');
      return;
    }

    let parsedGeoJSON;
    try {
      parsedGeoJSON = JSON.parse(formData.geojsonData);
    } catch (error) {
      toast.error('Invalid JSON format. Please check your GeoJSON data.');
      return;
    }

    // Basic GeoJSON validation
    if (parsedGeoJSON.type !== 'FeatureCollection') {
      toast.error('GeoJSON must be a FeatureCollection');
      return;
    }

    if (!parsedGeoJSON.features || parsedGeoJSON.features.length === 0) {
      toast.error('GeoJSON must contain at least one feature');
      return;
    }

    // Check if all features have the specified properties key
    const missingProperty = parsedGeoJSON.features.some(
      (feature: any) => !feature.properties?.[formData.propertiesKey]
    );

    if (missingProperty) {
      toast.error(`Some features are missing the property: ${formData.propertiesKey}`);
      return;
    }

    setIsLoading(true);

    try {
      const uploadData = {
        region_id: parseInt(formData.regionId),
        name: formData.name,
        description: formData.description || null,
        properties_key: formData.propertiesKey,
        geojson_data: parsedGeoJSON,
      };

      await apiPost('/api/charts/geojsons/upload/', uploadData);

      toast.success('GeoJSON uploaded successfully!');

      // Reset form
      setFormData({
        regionId: '',
        name: '',
        description: '',
        propertiesKey: '',
        geojsonData: '',
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload GeoJSON');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Custom GeoJSON</DialogTitle>
          <DialogDescription>
            Upload a custom GeoJSON file for a specific region. This will be available only to your
            organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto">
          {/* Region Selection */}
          <div>
            <Label htmlFor="region">Region/Layer *</Label>
            <Select
              value={formData.regionId}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, regionId: value }))}
              disabled={isLoading}
            >
              <SelectTrigger id="region">
                <SelectValue placeholder="Select a region" />
              </SelectTrigger>
              <SelectContent>
                {regions?.map((region: any) => (
                  <SelectItem key={region.id} value={region.id.toString()}>
                    {region.display_name} ({region.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Custom States 2024"
              disabled={isLoading}
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description"
              disabled={isLoading}
            />
          </div>

          {/* Properties Key */}
          <div>
            <Label htmlFor="propertiesKey">Properties Key *</Label>
            <Input
              id="propertiesKey"
              value={formData.propertiesKey}
              onChange={(e) => setFormData((prev) => ({ ...prev, propertiesKey: e.target.value }))}
              placeholder="e.g., NAME, name, state_name"
              disabled={isLoading}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              The property name in each feature that contains the region name (e.g., "NAME", "name",
              "state_name")
            </p>
          </div>

          {/* GeoJSON Data */}
          <div>
            <Label htmlFor="geojsonData">GeoJSON Data *</Label>
            <Textarea
              id="geojsonData"
              value={formData.geojsonData}
              onChange={(e) => setFormData((prev) => ({ ...prev, geojsonData: e.target.value }))}
              placeholder="Paste your GeoJSON FeatureCollection here..."
              className="h-[300px] font-mono text-sm resize-none"
              disabled={isLoading}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Must be a valid GeoJSON FeatureCollection with features containing the specified
              properties key
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Uploading...' : 'Upload GeoJSON'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
