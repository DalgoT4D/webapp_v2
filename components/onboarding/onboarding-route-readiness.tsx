'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface OnboardingRouteReadiness {
  impactPageReady: boolean;
  setImpactPageReady: (ready: boolean) => void;
}

const OnboardingRouteReadinessContext = createContext<OnboardingRouteReadiness | null>(null);

export function OnboardingRouteReadinessProvider({ children }: { children: React.ReactNode }) {
  const [impactPageReady, setImpactPageReady] = useState(false);
  const value = useMemo(() => ({ impactPageReady, setImpactPageReady }), [impactPageReady]);

  return (
    <OnboardingRouteReadinessContext.Provider value={value}>
      {children}
    </OnboardingRouteReadinessContext.Provider>
  );
}

function useOnboardingRouteReadiness() {
  const context = useContext(OnboardingRouteReadinessContext);
  if (!context) {
    throw new Error('Onboarding route readiness must be used inside its provider');
  }
  return context;
}

/**
 * The URL can change to /impact before Next has replaced the previous route's visible tree.
 * The page itself marks readiness after it has mounted, giving global onboarding UI a reliable
 * boundary that cannot fire over the outgoing free-trial progress screen (DALGO-1741).
 */
export function useMarkImpactPageReady() {
  const { setImpactPageReady } = useOnboardingRouteReadiness();

  useEffect(() => {
    setImpactPageReady(true);
    return () => setImpactPageReady(false);
  }, [setImpactPageReady]);
}

export function useImpactPageReady() {
  return useOnboardingRouteReadiness().impactPageReady;
}
