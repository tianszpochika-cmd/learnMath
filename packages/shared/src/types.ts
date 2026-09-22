/** 统一响应体（04 §1）：{ code, message, data }，HTTP 恒 200 时业务态看 code。 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** 分页（04 通用参数 page/pageSize ≤100）。 */
export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** SSE 帧事件（04 §2.4）。 */
export interface SseEvent {
  event: string;
  data: string;
}

/** 判分结果（04 attempt-answer 投影）。 */
export interface JudgeFeedback {
  correct: boolean;
  explanation?: string;
  scoreDelta?: number;
}
