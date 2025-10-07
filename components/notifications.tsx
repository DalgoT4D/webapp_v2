'use client';

import { useSearchParams } from 'next/navigation';
import { embeddedAppUrl } from '@/constants/constants';
import SharedIframe from './shared-iframe';

export default function Notifications() {
  const searchParams = useSearchParams();

  return (
    <SharedIframe
      src={`${embeddedAppUrl}/notifications?tab=all&fullwidth=true`}
      title="Notifications"
    />
  );
}
