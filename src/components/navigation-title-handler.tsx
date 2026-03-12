'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Map of routes to titles for immediate updates
const ROUTE_TITLES: Record<string, string> = {
  '/charts': 'Charts',
  '/dashboards': 'Dashboards',
  '/metrics': 'Metrics',
  '/ingest': 'Ingest',
  '/transform': 'Transform',
  '/orchestrate': 'Orchestrate',
  '/explore': 'Explore',
  '/data-quality': 'Data Quality',
  '/pipeline': 'Pipeline Overview',
  '/impact': 'Impact',
  '/notifications': 'Notifications',
};

export function NavigationTitleHandler(): null {
  const pathname = usePathname();

  useEffect(() => {
    // Find matching route title
    let title = 'Dalgo - Data Intelligence Platform'; // fallback

    // Check for exact matches first
    if (ROUTE_TITLES[pathname]) {
      title = `${ROUTE_TITLES[pathname]} - Dalgo`;
    } else {
      // Check for partial matches (for dynamic routes)
      for (const [route, routeTitle] of Object.entries(ROUTE_TITLES)) {
        if (pathname.startsWith(route) && route !== '/') {
          title = `${routeTitle} - Dalgo`;
          break;
        }
      }
    }

    // Set title immediately on navigation
    document.title = title;
  }, [pathname]);

  return null; // This component doesn't render anything
}
