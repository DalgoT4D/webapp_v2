import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  Comment,
  CommentStates,
  MentionableUser,
  CreateCommentPayload,
  MarkReadPayload,
} from '@/types/comments';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ---- Read hooks ----

export function useComments(
  snapshotId: number | null,
  targetType: 'summary' | 'chart',
  chartId?: number
) {
  const params = new URLSearchParams();
  if (snapshotId) params.set('snapshot_id', String(snapshotId));
  params.set('target_type', targetType);
  if (chartId !== undefined) params.set('chart_id', String(chartId));

  const { data, error, isLoading, mutate } = useSWR<ApiResponse<Comment[]>>(
    snapshotId ? `/api/comments/?${params.toString()}` : null,
    apiGet,
    { revalidateOnFocus: false }
  );

  return {
    comments: data?.data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useCommentStates(snapshotId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<{ states: CommentStates }>>(
    snapshotId ? `/api/comments/states/?snapshot_id=${snapshotId}` : null,
    apiGet,
    { revalidateOnFocus: false }
  );

  return {
    states: Array.isArray(data?.data?.states) ? data.data.states : [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useMentionableUsers() {
  const { data, error, isLoading } = useSWR<ApiResponse<MentionableUser[]>>(
    '/api/comments/mentionable-users/',
    apiGet,
    { revalidateOnFocus: false }
  );

  return {
    users: data?.data || [],
    isLoading,
    isError: error,
  };
}

// ---- Mutation functions ----

export async function createComment(payload: CreateCommentPayload): Promise<Comment> {
  const response: ApiResponse<Comment> = await apiPost('/api/comments/', payload);
  return response.data;
}

export async function updateComment(commentId: number, content: string): Promise<Comment> {
  const response: ApiResponse<Comment> = await apiPut(`/api/comments/${commentId}/`, { content });
  return response.data;
}

export async function deleteComment(commentId: number): Promise<void> {
  await apiDelete(`/api/comments/${commentId}/`);
}

export async function markAsRead(payload: MarkReadPayload): Promise<void> {
  await apiPost('/api/comments/mark-read/', payload);
}
