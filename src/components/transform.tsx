import { embeddedAppUrl } from '@/constants/constants';
import SharedIframe from './shared-iframe';

export default function Transform() {
  return <SharedIframe src={`${embeddedAppUrl}/pipeline/transform`} title="Data Transformation" />;
}
