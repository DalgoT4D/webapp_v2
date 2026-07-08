import Billing from '@/components/settings/billing';
import { ADMIN_ROLES, RoleGuard } from '@/lib/rbac';

export default function SettingsBillingPage() {
  return (
    <RoleGuard roles={ADMIN_ROLES}>
      <Billing />
    </RoleGuard>
  );
}
