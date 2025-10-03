import { embeddedAppUrl } from '@/constants/constants';
import SharedIframe from './shared-iframe';

export default function PipelineOverview() {
  return <SharedIframe src={`${embeddedAppUrl}/pipeline?hide=true`} title="Data Orchestration" />;
}
