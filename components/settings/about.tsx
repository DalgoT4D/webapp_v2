'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { apiGet } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ToolInfo {
  [toolName: string]: {
    version: string;
  };
}

export default function About() {
  const [toolInfo, setToolInfo] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToolInfo = async () => {
      try {
        const response = await apiGet('/api/orgpreferences/toolinfo');
        if (response.success && response.res) {
          setToolInfo(response.res);
        }
      } catch (err: any) {
        console.error('Failed to fetch tool information:', err);
        setError('Failed to load tool information');
      } finally {
        setLoading(false);
      }
    };

    fetchToolInfo();
  }, []);

  const getToolLogo = (toolName: string) => {
    // Map tool names to their logo filenames
    const logoMap: { [key: string]: string } = {
      Airbyte: 'airbyte.webp',
      Prefect: 'prefect.svg',
      DBT: 'dbt.png',
      Elementary: 'elementary.svg',
      Superset: 'superset.png',
    };
    return `/tools/${logoMap[toolName] || 'default.svg'}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading tool information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">About</h1>
        <p className="text-muted-foreground">
          Software versions and system information for Dalgo platform
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform Components</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {toolInfo.map((tool, index) => {
              const toolName = Object.keys(tool)[0];
              const toolData = tool[toolName];

              return (
                <div
                  key={index}
                  className="flex items-center space-x-4 p-4 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex-shrink-0 w-12 h-12 relative">
                    <Image
                      src={getToolLogo(toolName)}
                      alt={`${toolName} logo`}
                      width={30}
                      height={30}
                      className="object-contain"
                    />
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-semibold text-lg">{toolName}</h3>
                    <p className="text-sm text-muted-foreground">Version {toolData.version}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          <a
            href="https://dalgo.org/privacy-policy/"
            target="_blank"
            className="text-primary underline hover:text-primary/80"
          >
            Privacy Policy
          </a>
        </p>
        <p className="mt-2">© {new Date().getFullYear()} Dalgo Platform. All rights reserved.</p>
        <p className="mt-2">
          For support, please contact{' '}
          <a href="mailto:support@dalgo.org" className="text-primary underline">
            support@dalgo.org
          </a>
        </p>
      </div>
    </div>
  );
}
