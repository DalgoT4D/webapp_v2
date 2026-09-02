'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserPlus, Search, Trash2, Mail } from 'lucide-react';
import { useUserGroup, useUserGroupActions } from '@/hooks/api/useAccess';
import { AddMemberDialog } from './AddMemberDialog';
import type { GroupMember } from '@/types/user-groups';

interface Props {
  groupId: number;
}

export function GroupDetailPage({ groupId }: Props) {
  const router = useRouter();
  const { group, isLoading, mutate } = useUserGroup(groupId);
  const { removeMember } = useUserGroupActions();

  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!group?.members) return [];
    const q = search.trim().toLowerCase();
    if (!q) return group.members;
    return group.members.filter((m) => m.email.toLowerCase().includes(q));
  }, [group?.members, search]);

  const handleRemove = async (member: GroupMember) => {
    setRemovingId(member.member_id);
    try {
      await removeMember(groupId, member.member_id);
      mutate();
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!group) {
    return <p className="text-muted-foreground p-6">Group not found.</p>;
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to groups
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {group.name}
              <span className="ml-2">
                · {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
              </span>
            </h1>
          </div>
          <Button variant="primary" onClick={() => setShowAddDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            ADD MEMBER
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
            className="pl-9"
          />
        </div>

        <div className="border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[55%]">Email</TableHead>
                <TableHead className="w-[30%]">Role</TableHead>
                <TableHead className="w-[15%]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((member) => (
                <TableRow key={member.member_id} className="hover:bg-gray-50">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      {member.status === 'pending' && (
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm">{member.email}</span>
                      {member.status === 'pending' && (
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-gray-600">
                    {member.role_name ?? '—'}
                  </TableCell>
                  <TableCell className="py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={removingId === member.member_id}
                      onClick={() => handleRemove(member)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    {search ? 'No members match your search.' : 'No members yet.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddMemberDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        groupId={groupId}
        existingMembers={group.members}
        onSuccess={() => mutate()}
      />
    </div>
  );
}
