import { GroupDetailPage } from '@/components/settings/access/GroupDetailPage';

export default function GroupDetailRoute({ params }: { params: { groupId: string } }) {
  return <GroupDetailPage groupId={Number(params.groupId)} />;
}
