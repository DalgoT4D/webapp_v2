import { embeddedAppUrl } from '@/constants/constants';
import SharedIframe from './shared-iframe';

export default function ExploreData() {
  return <SharedIframe src={`${embeddedAppUrl}/explore`} title="Data Exploration" />;
}
