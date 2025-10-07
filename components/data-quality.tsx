import { embeddedAppUrl } from '@/constants/constants';
import SharedIframe from './shared-iframe';

export default function DataQuality() {
  return <SharedIframe src={`${embeddedAppUrl}/data-quality?`} title="Data Quality" />;
}
