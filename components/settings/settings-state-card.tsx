'use client';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SettingsStateCardProps {
  title: string;
  description: string;
}

export function SettingsStateCard({ title, description }: SettingsStateCardProps) {
  return (
    <div className="container mx-auto max-w-4xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
