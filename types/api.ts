/** Envelope the backend wraps most non-paginated responses in. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
