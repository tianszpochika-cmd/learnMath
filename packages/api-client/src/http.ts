import { ApiError } from "@learnmath/shared";

/**
 * HTTP 客户端（05 §6 · 04 §1/§2；纯逻辑可注入 Transport 单测）。
 *
 * 职责：
 *  - 业务解包：HTTP 恒 200，`code!==0` → 抛 {@link ApiError}；
 *  - **401 → 单飞（single-flight）刷新**：并发 401 共享同一个刷新 Promise，
 *    刷新只发生一次，成功后各自带新 token 重试一次；失败则集体拒绝且清理在飞标记
 *    （下一次请求可再次尝试刷新）；
 *  - Transport 注入式：生产用 fetch，测试用假实现（无网络、无环境依赖）。
 */

export interface HttpRequest {
  method: string;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** 内部：是否已因 401 重试过（防重试风暴）。 */
  retried?: boolean;
}

export interface HttpResponse {
  status: number;
  json?: unknown;
}

export type Transport = (req: HttpRequest, access: string | null) => Promise<HttpResponse>;

export interface HttpClientOptions {
  baseUrl: string;
  transport?: Transport;
  getAccess(): string | null;
  onAccess(token: string | null): void;
  /** 刷新调用（返回新 access；内部用 refresh token 换发）。未配置则 401 不重试。 */
  refreshCall?: () => Promise<string>;
  /** 是否做业务解包（默认 true）。 */
  unwrap?: boolean;
}

export interface HttpClient {
  request<T>(req: HttpRequest): Promise<T>;
  /** 当前在飞的刷新 Promise（测试/诊断）。 */
  refreshing(): Promise<string> | null;
}

function buildUrl(baseUrl: string, req: HttpRequest): string {
  const qs = new URLSearchParams();
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) {
      if (v !== undefined && v !== "") {
        qs.append(k, String(v));
      }
    }
  }
  const suffix = qs.toString();
  return baseUrl.replace(/\/$/, "") + req.path + (suffix ? `?${suffix}` : "");
}

export function createHttpClient(opts: HttpClientOptions): HttpClient {
  const unwrap = opts.unwrap !== false;
  const transport: Transport =
    opts.transport ||
    (async (req, access) => {
      const res = await fetch(buildUrl(opts.baseUrl, req), {
        method: req.method,
        headers: {
          "content-type": "application/json",
          ...(access ? { authorization: `Bearer ${access}` } : {}),
          ...(req.headers || {}),
        },
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
      });
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        json = undefined;
      }
      return { status: res.status, json };
    });

  let refreshing: Promise<string> | null = null;

  async function ensureRefresh(): Promise<string> {
    if (!refreshing) {
      const p = (async () => {
        const next = await opts.refreshCall!();
        opts.onAccess(next);
        return next;
      })();
      // 始终清理在飞标记（成功/失败都允许下一轮再次尝试）
      refreshing = p.then(
        (v) => {
          refreshing = null;
          return v;
        },
        (e) => {
          refreshing = null;
          throw e;
        },
      );
    }
    return refreshing;
  }

  async function once(req: HttpRequest): Promise<HttpResponse> {
    return transport(req, opts.getAccess());
  }

  async function request<T>(req: HttpRequest): Promise<T> {
    let res = await once(req);
    if (res.status === 401 && opts.refreshCall && !req.retried) {
      await ensureRefresh(); // 单飞：并发 401 只刷一次
      req = { ...req, retried: true };
      res = await once(req); // 重试恰好一次
    }
    if (res.status === 401) {
      throw new ApiError(2001);
    }
    if (res.status === 403) {
      throw new ApiError(2004);
    }
    if (res.status >= 500) {
      throw new ApiError(5000);
    }
    if (unwrap && res.json && typeof res.json === "object" && res.json !== null) {
      const body = res.json as { code?: number; message?: string; data?: T };
      if (typeof body.code === "number" && body.code !== 0) {
        throw new ApiError(body.code, body.message);
      }
      return body.data as T;
    }
    return res.json as T;
  }

  return {
    request,
    refreshing: () => refreshing,
  };
}
