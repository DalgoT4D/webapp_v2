import { embeddedAppUrl } from '@/constants/constants';
import SharedIframe from './shared-iframe';

export default function Orchestrate() {
  return (
    <SharedIframe
      src={`${embeddedAppUrl}/pipeline/orchestrate?hide=true`}
      title="Data Orchestration"
    />
  );
}
