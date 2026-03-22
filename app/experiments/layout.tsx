import { MetricsProvider } from './_lib/metrics-context';
import { ExperimentsShell } from './ExperimentsShell';

export default function ExperimentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <MetricsProvider>
      <ExperimentsShell>{children}</ExperimentsShell>
    </MetricsProvider>
  );
}
