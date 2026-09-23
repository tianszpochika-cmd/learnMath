import { createAuthApi, createHttpClient, type AuthApi, type HttpClient, type HttpRequest } from "@learnmath/api-client";
import { ApiError } from "@learnmath/shared";
import { useAuthStore } from "../stores/auth";

/**
 * Call after Pinia is installed. The base URL is an origin; callers use full
 * /api/app/v1 paths, so a configured prefix is stripped to avoid duplication.
 */
let cached: { bare: HttpClient; auth: AuthApi; http: HttpClient; ensureSession: () => Promise<boolean> } | null = null;

function baseUrl(): string {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  const configured = (env.VITE_APP_API_BASE ?? env.VITE_API_BASE ?? "").trim().replace(/\/+$/, "");
  return configured.replace(/\/api\/app\/v1$/i, "");
}

function clients() {
  if (cached) return cached;
  const store = useAuthStore();
  const bare = createHttpClient({
    baseUrl: baseUrl(),
    getAccess: () => null,
    onAccess: () => {},
  });
  const publicAuth = createAuthApi(bare);
  let renewing: Promise<string> | null = null;
  function refreshAccess(): Promise<string> {
    if (!renewing) {
      const rt = store.refreshToken;
      if (!rt) return Promise.reject(new ApiError(2001));
      renewing = publicAuth.refresh(rt).then((tokens) => {
        store.setSession({ ...tokens, userId: store.userId });
        return tokens.accessToken;
      }).catch((error: unknown) => {
        if (error instanceof ApiError && [2001, 2003, 2008, 2009].includes(error.code)) store.clear();
        throw error;
      }).finally(() => { renewing = null; });
    }
    return renewing;
  }
  const core = createHttpClient({
    baseUrl: baseUrl(),
    getAccess: () => store.accessToken,
    onAccess: (t) => store.setAccess(t),
  });
  // 04 §1 uses HTTP 200 for business errors, while a gateway may use HTTP 401.
  // Handle both here so one request can trigger at most one refresh and retry.
  const http: HttpClient = {
    async request<T>(req: HttpRequest): Promise<T> {
      const accessAtStart = store.accessToken;
      try { return await core.request<T>(req); }
      catch (error) {
        if (!(error instanceof ApiError) || ![2001, 2003].includes(error.code) ||
          req.retried || !store.refreshToken || /^\/api\/app\/v1\/auth\//.test(req.path)) throw error;
        // A concurrent request may already have rotated the token by now.
        if (store.accessToken === accessAtStart) await refreshAccess();
        return core.request<T>({ ...req, retried: true });
      }
    },
    refreshing: () => renewing
  };
  const auth: AuthApi = {
    ...publicAuth,
    logout: async () => { await http.request<void>({ method: "POST", path: "/api/app/v1/auth/logout" }); }
  };
  cached = {
    bare, auth, http,
    ensureSession: async () => {
      if (store.accessToken) return true;
      if (!store.refreshToken) return false;
      try { await refreshAccess(); return true; }
      catch { return false; }
    }
  };
  return cached;
}

export function getAppHttp(): HttpClient { return clients().http; }

export function getAuthApi(): { bare: HttpClient; auth: AuthApi } {
  const { bare, auth } = clients();
  return { bare, auth };
}

export function ensureAuthSession(): Promise<boolean> { return clients().ensureSession(); }
