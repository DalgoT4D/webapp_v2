import { redirect } from 'next/navigation';

// Legacy route — org access defaults now live on Settings → Access (Roles tab).
export default function AccessManagementPage() {
  redirect('/settings/access?tab=roles');
}
