'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function PendoScript() {
  const { isAuthenticated, currentOrg, getCurrentOrgUser } = useAuthStore();
  const pendoApiKey = process.env.NEXT_PUBLIC_PENDO_API_KEY;

  useEffect(() => {
    // Only initialize Pendo when user is authenticated and we have org data
    if (isAuthenticated && currentOrg && typeof window !== 'undefined' && window.pendo) {
      const currentOrgUser = getCurrentOrgUser();

      if (currentOrgUser) {
        // Initialize Pendo with user and account data
        window.pendo.initialize({
          visitor: {
            id: currentOrgUser.email, // Using email as unique visitor ID
            email: currentOrgUser.email,
            role: currentOrgUser.new_role_slug,
            active: currentOrgUser.active,
          },
          account: {
            id: currentOrg.slug, // Organization slug as account ID
            name: currentOrg.name,
          },
        });
      }
    }
  }, [isAuthenticated, currentOrg, getCurrentOrgUser]);

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
