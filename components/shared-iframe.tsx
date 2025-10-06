'use client';

import { useEffect, useRef, useState } from 'react';
import { embeddedAppUrl } from '@/constants/constants';

interface SharedIframeProps {
  src: string;
  title: string;
  className?: string;
}

export default function SharedIframe({ src, title, className }: SharedIframeProps) {
  const [iframeSrc, setIframeSrc] = useState<string>('');

  useEffect(() => {
    // Get the auth token and append it as a query parameter
    const authToken = localStorage.getItem('authToken');
    const selectedOrg = localStorage.getItem('selectedOrg');

    console.log('SharedIframe: Setting up iframe with org:', selectedOrg);

    // Parse the original URL
    const url = new URL(src);

    // Add auth token as query parameter if available
    if (authToken) {
      url.searchParams.set('embedToken', authToken);
    }

    if (selectedOrg) {
      url.searchParams.set('embedOrg', selectedOrg);
    }

    // Add a flag to indicate this is embedded
    url.searchParams.set('embedApp', 'true');
    url.searchParams.set('embedHideHeader', 'true');

    const finalUrl = url.toString();
    console.log('SharedIframe: Final URL:', finalUrl);

    setIframeSrc(finalUrl);
  }, [src]);

  if (!iframeSrc) {
    return <div className="w-full h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="w-full h-screen overflow-hidden">
      <iframe
        className={className || 'w-full h-full border-0 block'}
        src={iframeSrc}
        title={title}
        allowFullScreen
        width="100%"
        height="100%"
        style={{
          width: '100vw',
          height: '100vh',
          minWidth: '100%',
          maxWidth: '100%',
          display: 'block',
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }}
      />
    </div>
  );
}
