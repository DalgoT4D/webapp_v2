'use client';

import { useSearchParams } from 'next/navigation';
import { embeddedAppUrl } from '@/constants/constants';
import SharedIframe from './shared-iframe';

export default function ExploreData() {
  const searchParams = useSearchParams();
  const iframeUrl = new URL(`${embeddedAppUrl}/explore`);
  const schemaName = searchParams.get('schema_name');
  const tableName = searchParams.get('table_name');
  if (schemaName) {
    iframeUrl.searchParams.set('schema_name', schemaName);
  }
  if (tableName) {
    iframeUrl.searchParams.set('table_name', tableName);
  }

  return <SharedIframe src={iframeUrl.toString()} title="Data Exploration" />;
}
