import { createAuthApi, createHttpClient, type AuthApi, type HttpClient, type HttpRequest, type HttpResponse, type Transport } from "@learnmath/api-client";
import { ApiError } from "@learnmath/shared";

type UniRequest = (options: {
  url: string; method: string; header: Record<string, string>; data?: unknown;
  success: (result: { statusCode: number; data: unknown }) => void;
  fail: (error: unknown) => void;
}) => void;
declare const uni: {
  request: UniRequest;
  getStorageSync(key: string): unknown;
  getStorageInfoSync?(): { keys: string[] };
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
};

const SESSION_KEY = "lm.mobile.auth";
interface StoredSession { refreshToken: string | null; userId: string | null }
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;

function readStored(): StoredSession {
  try {
    const raw = uni.getStorageSync(SESSION_KEY);
    const value = typeof raw === "string" ? JSON.parse(raw) as Record<string, unknown> : raw as Record<string, unknown>;
    return { refreshToken: text(value?.refreshToken), userId: text(value?.userId) };
  } catch { return { refreshToken: null, userId: null }; }
}

const session: StoredSession & { accessToken: string | null } = { ...readStored(), accessToken: null };
export function currentMobileUserId(): string | null { return session.userId; }
export function currentMobileAccessToken(): string | null { return session.accessToken; }
export function hasMobileSession(): boolean { return Boolean(session.accessToken || session.refreshToken); }
export function setMobileSession(value: { accessToken: string; refreshToken: string; userId: string | null }): void {
  session.accessToken = value.accessToken;
  session.refreshToken = value.refreshToken;
  session.userId = value.userId;
  try { uni.setStorageSync(SESSION_KEY, { refreshToken: value.refreshToken, userId: value.userId }); } catch { /* session remains in memory */ }
}
export function clearMobileSession(): void {
  const previousUserId = session.userId;
  session.accessToken = null; session.refreshToken = null; session.userId = null;
  try {
    if (previousUserId) for (const key of uni.getStorageInfoSync?.().keys ?? []) {
      if (key.startsWith(`lm.mobile.draft:${previousUserId}:`)) uni.removeStorageSync(key);
    }
    if (previousUserId) uni.removeStorageSync(`lm.mobile.activeAttempt:${previousUserId}`);
    uni.removeStorageSync(SESSION_KEY);
  } catch { /* storage unavailable */ }
}

export function mobileApiOrigin(): string {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  return (env.VITE_APP_API_BASE ?? env.VITE_API_BASE ?? "").trim().replace(/\/+$/, "").replace(/\/api\/app\/v1$/i, "");
}

export function mobileUrl(origin: string, request: HttpRequest): string {
  if (!request.path.startsWith("/api/app/v1/")) throw new Error("移动端请求必须使用学员域 API");
  const query = Object.entries(request.query ?? {})
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join("&");
  return origin.replace(/\/+$/, "") + request.path + (query ? `?${query}` : "");
}

export function createUniTransport(request: UniRequest, origin: string): Transport {
  return (input, access) => new Promise<HttpResponse>((resolve, reject) => {
    try {
      request({
        url: mobileUrl(origin, input), method: input.method,
        header: { "content-type": "application/json", ...(access ? { authorization: `Bearer ${access}` } : {}), ...(input.headers ?? {}) },
        data: input.body,
        success: (response) => resolve({ status: response.statusCode, json: response.data }),
        fail: () => reject(new ApiError(5004, "网络暂不可用，请检查连接后重试")),
      });
    } catch (error) { reject(error); }
  });
}

let cached: { bare: HttpClient; auth: AuthApi; http: HttpClient } | null = null;
let renewing: Promise<string> | null = null;
function clients() {
  if (cached) return cached;
  const transport = createUniTransport(uni.request, mobileApiOrigin());
  const bare = createHttpClient({ baseUrl: "", transport, getAccess: () => null, onAccess: () => {} });
  const publicAuth = createAuthApi(bare);
  async function refreshAccess(): Promise<string> {
    if (!renewing) {
      renewing = (async () => {
        const refreshToken = session.refreshToken;
        if (!refreshToken) throw new ApiError(2001);
        const result = await publicAuth.refresh(refreshToken);
        setMobileSession({ ...result, userId: session.userId });
        return result.accessToken;
      })().catch((error: unknown) => {
        if (error instanceof ApiError && [2001, 2003, 2008, 2009].includes(error.code)) clearMobileSession();
        throw error;
      }).finally(() => { renewing = null; });
    }
    return renewing;
  }
  const core = createHttpClient({ baseUrl: "", transport, getAccess: () => session.accessToken, onAccess: (token) => { session.accessToken = token; } });
  const http: HttpClient = {
    async request<T>(input: HttpRequest): Promise<T> {
      const accessAtStart = session.accessToken;
      try { return await core.request<T>(input); }
      catch (error) {
        if (!(error instanceof ApiError) || ![2001, 2003].includes(error.code) || input.retried || !session.refreshToken || /\/auth\//.test(input.path)) throw error;
        if (session.accessToken === accessAtStart) await refreshAccess();
        return core.request<T>({ ...input, retried: true });
      }
    },
    refreshing: () => renewing,
  };
  cached = { bare, auth: { ...publicAuth, logout: async () => { await http.request<void>({ method: "POST", path: "/api/app/v1/auth/logout" }); clearMobileSession(); } }, http };
  return cached;
}
export function getMobileHttp(): HttpClient { return clients().http; }
export function getMobileAuth(): AuthApi { return clients().auth; }
export async function ensureMobileSession(): Promise<boolean> {
  if (session.accessToken) return true;
  if (!session.refreshToken) return false;
  try { await clients().http.request<unknown>({ method: "GET", path: "/api/app/v1/user/profile" }); return Boolean(session.accessToken); }
  catch { return false; }
}
