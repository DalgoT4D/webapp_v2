export interface CommentAuthor {
  email: string;
  name?: string;
}

export interface CommentMention {
  email: string;
  name?: string;
}

export interface Comment {
  id: number;
  target_type: 'summary' | 'chart';
  snapshot_id: number;
  chart_id?: number;
  content: string;
  author: CommentAuthor;
  is_new: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  mentions: CommentMention[];
}

export type CommentIconState = 'none' | 'unread' | 'read' | 'mentioned';

export interface CommentStateEntry {
  target_type: 'summary' | 'chart';
  chart_id: number | null;
  state: CommentIconState;
  count: number; // total comments
  unread_count: number; // unread comments
}

export type CommentStates = CommentStateEntry[];

export interface MentionableUser {
  email: string;
  name?: string;
}

export interface CreateCommentPayload {
  snapshot_id: number;
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
  snapshot_id: number;
  target_type: 'summary' | 'chart';
  chart_id?: number;
}
