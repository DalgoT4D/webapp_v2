// Shared chrome for every /free-trial screen: the teal constellation background and
// the centering that all three pages used to repeat for themselves.
//
// These routes already render bare — components/client-layout.tsx treats anything
// under /free-trial as public, so there is no sidebar or header to work around.
//
// The background canvas is what Figma's `image 124` layer depicts, so that asset is
// deliberately not exported.

import { AnimatedBackgroundSimple } from '@/components/ui/animated-background-simple';

export default function FreeTrialLayout({ children }: { children: React.ReactNode }) {
  return (
    <AnimatedBackgroundSimple>
      <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">{children}</main>
    </AnimatedBackgroundSimple>
  );
}
