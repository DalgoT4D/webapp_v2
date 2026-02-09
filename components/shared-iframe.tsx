'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useIframeCommunication } from '@/hooks/useIframeComm';
import { apiPost } from '@/lib/api';

interface SharedIframeProps {
  src: string;
  title: string;
  className?: string;
  scale?: number; // Scale factor (e.g., 0.75 for 75% size)
}

export default function SharedIframe({ src, title, className, scale = 1 }: SharedIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeReady, setIsIframeReady] = useState(false);
  // const [iframeToken, setIframeToken] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const hasInitialAuthBeenSent = useRef(false);
  const { selectedOrgSlug, isAuthenticated } = useAuthStore();

  // Parse origin from src URL and create allowed origins list
  const { targetOrigin, allowedOrigins } = useMemo(() => {
    try {
      const url = new URL(src);
      const origin = url.origin;

      // Create allowlist using configured embedded webapp URL
      const allowedOrigins: string[] = [];
      const embeddedWebappUrl = process.env.NEXT_PUBLIC_EMBEDDED_WEBAPP_URL;

      if (embeddedWebappUrl) {
        try {
          const embeddedOrigin = new URL(embeddedWebappUrl).origin;
          allowedOrigins.push(embeddedOrigin);
        } catch {
          console.warn('[SharedIframe] Invalid NEXT_PUBLIC_EMBEDDED_WEBAPP_URL format');
        }
      }

      return { targetOrigin: origin, allowedOrigins };
    } catch {
      return { targetOrigin: '*', allowedOrigins: [] as string[] };
    }
  }, [src]);

  const { sendAuthUpdate, sendOrgSwitch, sendLogout } = useIframeCommunication({
    iframeRef,
    targetOrigin,
    allowedOrigins,
  });

  // Function to fetch iframe token
  const fetchIframeToken = useCallback(async () => {
    if (!isAuthenticated) {
      return null;
    }

    try {
      console.log('[Parent] Fetching iframe token...');
      const response = await apiPost('/api/v2/iframe-token/', {});

      if (response?.success && response?.iframe_token) {
        console.log('[Parent] Got iframe token, expires in:', response.expires_in, 'seconds');
        // setIframeToken(response.iframe_token);
        return response.iframe_token;
      } else {
        console.warn('[Parent] Failed to get iframe token:', response);
        return null;
      }
    } catch (error) {
      console.error('[Parent] Error fetching iframe token:', error);
      return null;
    }
  }, [isAuthenticated]);

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

  // Reset iframe ready state when URL changes (navigation between pages) or key changes (remount)
  useEffect(() => {
    setIsIframeReady(false);
  }, [cleanUrl, iframeKey]);

  // Listen for iframe ready message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Enhanced origin validation with allowlist
      const isOriginAllowed =
        allowedOrigins.length > 0
          ? allowedOrigins.includes(event.origin)
          : targetOrigin !== '*' && event.origin === targetOrigin;

      if (!isOriginAllowed) {
        console.warn(
          '[Parent] Received message from untrusted origin:',
          event.origin,
          'Allowed origins:',
          allowedOrigins
        );
        return;
      }

      // Validate event source is from our iframe window
      if (event.source !== iframeRef.current?.contentWindow) {
        console.warn('[Parent] Message source does not match iframe window');
        return;
      }

      // Check if message is from our iframe
      if (event.data?.source === 'webapp' && event.data?.type === 'READY') {
        console.log('[Parent] Iframe is ready');
        setIsIframeReady(true);
        // Don't fetch token here - let the combined auth effect handle it
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [targetOrigin, allowedOrigins, iframeRef]);

  // Combined effect: Send auth updates when auth state changes and iframe is ready
  useEffect(() => {
    let isCancelled = false;
    let remountTimeoutId: NodeJS.Timeout | null = null;

    if (isIframeReady) {
      if (isAuthenticated && selectedOrgSlug) {
        console.log('[Parent] Auth state ready, fetching token and sending to iframe');
        fetchIframeToken().then((token) => {
          // Don't proceed if effect was cleaned up while fetching
          if (isCancelled) return;

          if (token) {
            sendAuthUpdate(token, selectedOrgSlug);

            // On first auth, remount iframe so it loads correct page with auth already in place
            // This fixes the issue where embedded app redirects to default route on first load
            if (!hasInitialAuthBeenSent.current) {
              hasInitialAuthBeenSent.current = true;
              console.log('[Parent] First auth sent, remounting iframe to load correct page');
              // 150ms delay gives embedded app time to complete signIn() before remount
              remountTimeoutId = setTimeout(() => {
                if (!isCancelled) {
                  setIframeKey((prev) => prev + 1);
                }
              }, 150);
            }
          }
        });
      } else if (!isAuthenticated) {
        console.log('[Parent] User logged out, sending logout signal to iframe');
        sendLogout();
      }
    }

    // Cleanup: cancel pending operations if component unmounts or effect re-runs
    return () => {
      isCancelled = true;
      if (remountTimeoutId) {
        clearTimeout(remountTimeoutId);
      }
    };
  }, [
    isAuthenticated,
    selectedOrgSlug,
    isIframeReady,
    fetchIframeToken,
    sendAuthUpdate,
    sendLogout,
  ]);

  // Send org switch when only org changes
  useEffect(() => {
    if (isIframeReady && isAuthenticated && selectedOrgSlug) {
      console.log('[Parent] Organization changed, sending update to iframe');
      sendOrgSwitch(selectedOrgSlug);
    }
  }, [selectedOrgSlug, isIframeReady, isAuthenticated, sendOrgSwitch]);

  // Token refresh mechanism - refresh every 4 minutes (before 5-minute expiry)
  useEffect(() => {
    if (!isAuthenticated || !isIframeReady) {
      return undefined;
    }

    console.log('[Parent] Setting up iframe token refresh (every 4 minutes)');
    const refreshInterval = setInterval(
      async () => {
        if (isAuthenticated && selectedOrgSlug) {
          console.log('[Parent] Refreshing iframe token...');
          const newToken = await fetchIframeToken();
          if (newToken) {
            sendAuthUpdate(newToken, selectedOrgSlug);
          }
        }
      },
      4 * 60 * 1000
    ); // 4 minutes

    return () => {
      console.log('[Parent] Clearing iframe token refresh interval');
      clearInterval(refreshInterval);
    };
  }, [isAuthenticated, isIframeReady, selectedOrgSlug, fetchIframeToken, sendAuthUpdate]);

  if (!cleanUrl) {
    return <div className="w-full h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div
      className="w-full h-screen overflow-hidden"
      style={{
        // Container sized for scaled content
        width: scale < 1 ? `${100 / scale}%` : '100%',
        height: scale < 1 ? `${100 / scale}vh` : '100vh',
        transformOrigin: 'top left',
        transform: scale < 1 ? `scale(${scale})` : 'none',
      }}
    >
      <iframe
        key={`${cleanUrl}-${iframeKey}`}
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
        }}
        onLoad={() => {
          console.log('[Parent] Iframe loaded');
        }}
      />
    </div>
  );
}
