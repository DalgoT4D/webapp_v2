import { redirect } from 'next/navigation';

// Legacy route — user management now lives on Settings → Access (People tab).
export default function UserManagementPage() {
  redirect('/settings/access?tab=people');
}
