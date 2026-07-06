// API response interfaces for Chat with Data (backend: ddpui/api/chat_with_data_api.py)

/** Standard backend wrapper: ddpui/utils/response_wrapper.py */
export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export type ChatStatusReason = 'ok' | 'feature_disabled' | 'llm_consent_required' | 'no_warehouse';

export interface ChatStatus {
  enabled: boolean;
  reason: ChatStatusReason;
}

export interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

/** A query the agent ran within a turn, replayed for the UI */
export interface SqlAttachment {
  sql: string;
  status: string;
  row_count?: number | null;
  columns?: string[] | null;
  rows?: string[][] | null;
}

/** One history bubble from GET /sessions/{id}/messages */
export interface CreatedChart {
  chart_id: number;
  title: string;
  url_path: string;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  sql_attachments: SqlAttachment[];
  charts?: CreatedChart[];
}

// ── WebSocket protocol (backend: ddpui/core/chat_with_data/runner.py) ──────

export interface ResultTable {
  columns: string[];
  rows: string[][];
  row_count: number;
}

export interface TokenEvent {
  type: 'token';
  text: string;
}

export interface ToolStartEvent {
  type: 'tool_start';
  tool: string;
  label: string;
  sql?: string | null;
}

export interface ToolEndEvent {
  type: 'tool_end';
  tool: string;
  status: 'success' | 'error';
}

export interface MessageCompleteEvent {
  type: 'message_complete';
  message: string;
  result_table?: ResultTable | null;
  charts?: CreatedChart[];
  usage?: { input_tokens: number; output_tokens: number };
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export interface TitleUpdatedEvent {
  type: 'title_updated';
  title: string;
}

export type ChatWsEvent =
  | TokenEvent
  | ToolStartEvent
  | ToolEndEvent
  | MessageCompleteEvent
  | ErrorEvent
  | TitleUpdatedEvent;

// ── UI message model (what useChatWithData reduces events into) ────────────

export interface ToolActivity {
  tool: string;
  label: string;
  sql?: string | null;
  status: 'running' | 'success' | 'error';
}

export interface ChatMessage {
  /** Stable render key — client-generated */
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** True while assistant text is still streaming in */
  streaming: boolean;
  tools: ToolActivity[];
  resultTable?: ResultTable | null;
  charts?: CreatedChart[];
  error?: string | null;
}
