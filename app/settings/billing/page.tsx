import Billing from '@/components/settings/billing';
import { RoleGuard } from '@/components/role-guard';

export default function SettingsBillingPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <Billing />
    </RoleGuard>
  );
}
