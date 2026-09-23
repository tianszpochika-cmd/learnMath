import { createHttpClient, type HttpClient, type HttpRequest } from "@learnmath/api-client";
import { ApiError } from "@learnmath/shared";
import { useAdminAuthStore } from "../stores/auth";

const PREFIX = "/api/admin/v1";
let cached: { bare: HttpClient; http: HttpClient; refresh: () => Promise<string> } | null = null;

function baseUrl(): string {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  const configured = (env.VITE_ADMIN_API_BASE ?? env.VITE_API_BASE ?? "").trim().replace(/\/+$/, "");
  return configured.replace(/\/api\/admin\/v1$/i, "");
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Management login and refresh must return a complete pair; no synthetic session. */
export function parseAdminTokens(value: unknown): { accessToken: string; refreshToken: string; adminName: string | null } {
  const source = record(value);
  const accessToken = typeof source.accessToken === "string" ? source.accessToken.trim() : "";
  const refreshToken = typeof source.refreshToken === "string" ? source.refreshToken.trim() : "";
  if (!accessToken || !refreshToken) throw new Error("管理认证服务未返回完整令牌");
  const admin = record(source.admin ?? source.user);
  const adminName = typeof admin.name === "string" && admin.name.trim() ? admin.name.trim() : null;
  return { accessToken, refreshToken, adminName };
}

function clients() {
  if (cached) return cached;
  const store = useAdminAuthStore();
  const bare = createHttpClient({ baseUrl: baseUrl(), getAccess: () => null, onAccess: () => {} });
  let renewing: Promise<string> | null = null;
  function refresh(): Promise<string> {
    if (!renewing) {
      const token = store.refreshToken;
      if (!token) return Promise.reject(new ApiError(2001));
      renewing = bare.request<unknown>({ method: "POST", path: PREFIX + "/auth/refresh", body: { refreshToken: token } })
        .then((value) => {
          const pair = parseAdminTokens(value);
          store.setSession({ ...pair, adminName: pair.adminName ?? store.adminName });
          return pair.accessToken;
        })
        .catch((error: unknown) => {
          if (error instanceof ApiError && [2001, 2003, 2005].includes(error.code)) store.clear();
          else store.setAccess(null);
          throw error;
        })
        .finally(() => { renewing = null; });
    }
    return renewing;
  }
  const core = createHttpClient({ baseUrl: baseUrl(), getAccess: () => store.accessToken, onAccess: (token) => store.setAccess(token) });
  // The API uses HTTP 200 for business auth errors; gateways can also return 401.
  const http: HttpClient = {
    async request<T>(req: HttpRequest): Promise<T> {
      const accessAtStart = store.accessToken;
      try { return await core.request<T>(req); }
      catch (error) {
        if (!(error instanceof ApiError) || ![2001, 2003].includes(error.code) || req.retried ||
          !store.refreshToken || /^\/api\/admin\/v1\/auth\//.test(req.path)) throw error;
        if (store.accessToken === accessAtStart) await refresh();
        try { return await core.request<T>({ ...req, retried: true }); }
        catch (retryError) {
          if (retryError instanceof ApiError && [2001, 2003, 2005].includes(retryError.code)) store.clear();
          throw retryError;
        }
      }
    },
    refreshing: () => renewing,
  };
  cached = { bare, http, refresh };
  return cached;
}

/** Management JWT and base URL are separate from the learner domain. */
export function getAdminHttp(): HttpClient {
  return clients().http;
}

export async function ensureAdminSession(): Promise<boolean> {
  const store = useAdminAuthStore();
  if (store.accessToken) return true;
  if (!store.refreshToken) return false;
  try { await clients().refresh(); return true; }
  catch { return false; }
}

export async function loginAdmin(account: string, password: string): Promise<void> {
  const cleanAccount = account.trim();
  if (!cleanAccount || !password) throw new Error("请填写账号和密码");
  const pair = parseAdminTokens(await clients().bare.request<unknown>({
    method: "POST", path: PREFIX + "/auth/login", body: { account: cleanAccount, password },
  }));
  useAdminAuthStore().setSession(pair);
}

/** Always clear the local session; only a successful request confirms remote revocation. */
export async function logoutAdmin(): Promise<boolean> {
  const store = useAdminAuthStore();
  let revoked = false;
  try {
    if (store.accessToken) {
      await getAdminHttp().request<unknown>({ method: "POST", path: PREFIX + "/auth/logout" });
      revoked = true;
    }
  } finally { store.clear(); }
  return revoked;
}
