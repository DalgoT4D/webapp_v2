export interface Comment {
  id: number;
  target_type: 'summary' | 'chart';
  snapshot_id: number;
  chart_id?: number;
  content: string;
  author_email: string;
  is_new: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  mentioned_emails: string[];
}

export type CommentIconState = 'none' | 'unread' | 'read' | 'mentioned';

export interface CommentStateEntry {
  target_type: 'summary' | 'chart';
  chart_id: number | null;
  state: CommentIconState;
}

export type CommentStates = CommentStateEntry[];

export interface MentionableUser {
  email: string;
}

export interface CreateCommentPayload {
  target_type: 'summary' | 'chart';
  chart_id?: number;
  content: string;
  mentioned_emails?: string[];
}

export interface UpdateCommentPayload {
  content: string;
  mentioned_emails?: string[];
}

export interface MarkReadPayload {
  target_type: 'summary' | 'chart';
  chart_id?: number;
}
