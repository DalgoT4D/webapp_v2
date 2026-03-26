import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  Comment,
  CommentStates,
  MentionableUser,
  CreateCommentPayload,
  UpdateCommentPayload,
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
  params.set('target_type', targetType);
  if (chartId !== undefined) params.set('chart_id', String(chartId));

  const { data, error, isLoading, mutate } = useSWR<ApiResponse<Comment[]>>(
    snapshotId ? `/api/reports/${snapshotId}/comments/?${params.toString()}` : null,
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
    snapshotId ? `/api/reports/${snapshotId}/comments/states/` : null,
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
    '/api/reports/mentionable-users/',
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

export async function createComment(
  snapshotId: number,
  payload: CreateCommentPayload
): Promise<Comment> {
  const response: ApiResponse<Comment> = await apiPost(
    `/api/reports/${snapshotId}/comments/`,
    payload
  );
  return response.data;
}

export async function updateComment(
  snapshotId: number,
  commentId: number,
  payload: UpdateCommentPayload
): Promise<Comment> {
  const response: ApiResponse<Comment> = await apiPut(
    `/api/reports/${snapshotId}/comments/${commentId}/`,
    payload
  );
  return response.data;
}

export async function deleteComment(snapshotId: number, commentId: number): Promise<void> {
  await apiDelete(`/api/reports/${snapshotId}/comments/${commentId}/`);
}

export async function markAsRead(snapshotId: number, payload: MarkReadPayload): Promise<void> {
  await apiPost(`/api/reports/${snapshotId}/comments/mark-read/`, payload);
}
