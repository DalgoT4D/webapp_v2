'use client';

import Script from 'next/script';
import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function PendoScript() {
  const { isAuthenticated, currentOrg } = useAuthStore();
  const pendoApiKey = process.env.NEXT_PUBLIC_PENDO_API_KEY;
  const [pendoInitialized, setPendoInitialized] = useState(false);
  const previousOrgSlugRef = useRef<string | null>(null);

  useEffect(() => {
    // Detect logout: reset Pendo state when user is no longer authenticated
    if (!isAuthenticated || !currentOrg) {
      if (pendoInitialized) {
        setPendoInitialized(false);
        previousOrgSlugRef.current = null;

        // Call Pendo's reset method if available to clear session data
        if (
          typeof window !== 'undefined' &&
          window.pendo &&
          typeof window.pendo.reset === 'function'
        ) {
          window.pendo.reset();
        }
      }
      return;
    }

    // Only proceed with initialization if Pendo script is loaded
    if (typeof window === 'undefined' || !window.pendo) {
      return;
    }

    const { getCurrentOrgUser } = useAuthStore.getState();
    const currentOrgUser = getCurrentOrgUser();

    if (!currentOrgUser) {
      return;
    }

    const visitorData = {
      id: currentOrgUser.email, // Using email as unique visitor ID
      email: currentOrgUser.email,
      role: currentOrgUser.new_role_slug,
      active: currentOrgUser.active,
    };

    const accountData = {
      id: currentOrg.slug, // Organization slug as account ID
      name: currentOrg.name,
    };

    // First time: Initialize Pendo
    if (!pendoInitialized) {
      window.pendo.initialize({
        visitor: visitorData,
        account: accountData,
      });
      setPendoInitialized(true);
      previousOrgSlugRef.current = currentOrg.slug;
    }
    // Org switch: Use identify() to update context and track the change
    else if (previousOrgSlugRef.current !== currentOrg.slug) {
      window.pendo.identify({
        visitor: visitorData,
        account: accountData,
      });
      previousOrgSlugRef.current = currentOrg.slug;
    }
  }, [isAuthenticated, currentOrg, pendoInitialized]);

  // Don't render script if API key is not configured
  if (!pendoApiKey) {
    console.warn('Pendo API key not configured. Set NEXT_PUBLIC_PENDO_API_KEY in .env');
    return null;
  }

  return (
    <Script
      id="pendo-script"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
(function(apiKey){
    (function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
    v=['initialize','identify','updateOptions','pageLoad','track'];for(w=0,x=v.length;w<x;++w)(function(m){
        o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
        y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
        z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');
})('${pendoApiKey}');
        `,
      }}
    />
  );
}
