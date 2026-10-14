import { render, screen, waitFor } from '@testing-library/react';
import {
  OnboardingRouteReadinessProvider,
  useImpactPageReady,
  useMarkImpactPageReady,
} from '../onboarding-route-readiness';

function ImpactPageMarker(): null {
  useMarkImpactPageReady();
  return null;
}

function ReadinessProbe() {
  return <span>{useImpactPageReady() ? 'ready' : 'waiting'}</span>;
}

describe('OnboardingRouteReadinessProvider', () => {
  it('becomes ready only while the actual impact page is mounted', async () => {
    const view = render(
      <OnboardingRouteReadinessProvider>
        <ReadinessProbe />
      </OnboardingRouteReadinessProvider>
    );

    expect(screen.getByText('waiting')).toBeInTheDocument();

    view.rerender(
      <OnboardingRouteReadinessProvider>
        <ImpactPageMarker />
        <ReadinessProbe />
      </OnboardingRouteReadinessProvider>
    );
    await waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument());

    view.rerender(
      <OnboardingRouteReadinessProvider>
        <ReadinessProbe />
      </OnboardingRouteReadinessProvider>
    );
    await waitFor(() => expect(screen.getByText('waiting')).toBeInTheDocument());
  });
});
