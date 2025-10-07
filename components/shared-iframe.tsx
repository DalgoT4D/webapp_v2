'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { embeddedAppUrl } from '@/constants/constants';

interface SharedIframeProps {
  src: string;
  title: string;
  className?: string;
}

export default function SharedIframe({ src, title, className }: SharedIframeProps) {
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const { currentOrg } = useAuthStore();

  useEffect(() => {
    // Get the auth token from localStorage
    const authToken = localStorage.getItem('authToken');

    // Parse the original URL
    const url = new URL(src);

    // Add auth token as query parameter if available
    if (authToken) {
      url.searchParams.set('embedToken', authToken);
    }

    // Use the current org from the store instead of localStorage
    if (currentOrg?.slug) {
      url.searchParams.set('embedOrg', currentOrg.slug);
    }

    // Add a flag to indicate this is embedded
    url.searchParams.set('embedApp', 'true');
    url.searchParams.set('embedHideHeader', 'true');

    const finalUrl = url.toString();
    console.log('SharedIframe: Final URL:', finalUrl);

    setIframeSrc(finalUrl);
  }, [src, currentOrg?.slug]); // React to both src and currentOrg changes

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
