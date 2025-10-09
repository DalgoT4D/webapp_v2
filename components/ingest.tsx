import { embeddedAppUrl } from '@/constants/constants';
import SharedIframe from './shared-iframe';

export default function Ingest() {
  return (
    <SharedIframe
      src={`${embeddedAppUrl}/pipeline/ingest?tab=connections&fullwidth=true`}
      title="Data Ingestion Pipeline"
    />
  );
}
