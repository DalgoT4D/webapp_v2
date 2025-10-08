'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useIframeCommunication } from '@/hooks/useIframeComm';

interface SharedIframeProps {
  src: string;
  title: string;
  className?: string;
}

export default function SharedIframe({ src, title, className }: SharedIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeReady, setIsIframeReady] = useState(false);
  const { token, selectedOrgSlug } = useAuthStore();

  // Parse origin from src URL
  const targetOrigin = useMemo(() => {
    try {
      const url = new URL(src);
      return url.origin;
    } catch {
      return '*';
    }
  }, [src]);

  const { sendAuthUpdate, sendOrgSwitch, sendLogout } = useIframeCommunication({
    iframeRef,
    targetOrigin,
  });

  // Clean URL - remove all embed-related query params
  const cleanUrl = useMemo(() => {
    const url = new URL(src);
    // Remove all legacy embed query params
    url.searchParams.delete('embedToken');
    url.searchParams.delete('embedOrg');
    url.searchParams.delete('embedApp');
    url.searchParams.delete('embedHideHeader');
    return url.toString();
  }, [src]);

  // Listen for iframe ready message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin if not using wildcard
      if (targetOrigin !== '*' && event.origin !== targetOrigin) {
        console.warn('[Parent] Received message from unexpected origin:', event.origin);
        return;
      }

      // Check if message is from our iframe
      if (event.data?.source === 'webapp' && event.data?.type === 'READY') {
        console.log('[Parent] Iframe is ready, sending initial auth state');
        setIsIframeReady(true);

        // Send initial auth state
        if (token && selectedOrgSlug) {
          sendAuthUpdate(token, selectedOrgSlug);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [token, selectedOrgSlug, sendAuthUpdate, targetOrigin]);

  // Send auth updates when auth state changes and iframe is ready
  useEffect(() => {
    if (isIframeReady) {
      if (token && selectedOrgSlug) {
        console.log('[Parent] Sending auth update to iframe');
        sendAuthUpdate(token, selectedOrgSlug);
      } else if (!token) {
        console.log('[Parent] User logged out, sending logout signal to iframe');
        sendLogout();
      }
    }
  }, [token, selectedOrgSlug, isIframeReady, sendAuthUpdate, sendLogout]);

  // Send org switch when only org changes
  useEffect(() => {
    if (isIframeReady && token && selectedOrgSlug) {
      console.log('[Parent] Organization changed, sending update to iframe');
      sendOrgSwitch(selectedOrgSlug);
    }
  }, [selectedOrgSlug, isIframeReady, token, sendOrgSwitch]);

  if (!cleanUrl) {
    return <div className="w-full h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="w-full h-screen overflow-hidden">
      <iframe
        ref={iframeRef}
        className={className || 'w-full h-full border-0 block'}
        src={cleanUrl}
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
        onLoad={() => {
          console.log('[Parent] Iframe loaded');
        }}
      />
    </div>
  );
}
