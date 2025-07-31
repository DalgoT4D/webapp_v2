import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Map } from 'lucide-react';

interface WorkInProgressProps {
  onBack?: () => void;
}

export function WorkInProgress({ onBack }: WorkInProgressProps) {
  return (
    <Card className="p-8 text-center">
      <Map className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">Map Charts Coming Soon</h3>
      <p className="text-muted-foreground">
        Geographic visualizations are currently in development. Please check back later or use other
        chart types for now.
      </p>
      {onBack && (
        <Button variant="outline" onClick={onBack} className="mt-4">
          Choose Another Chart Type
        </Button>
      )}
    </Card>
  );
}
