import { redirect } from 'next/navigation';

// Legacy route — groups now live on Settings → Access (Groups tab).
export default function GroupsPage() {
  redirect('/settings/access?tab=groups');
}
