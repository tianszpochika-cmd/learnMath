import { createAuthApi, createHttpClient, type AuthApi } from "@learnmath/api-client";
import { ApiError } from "@learnmath/shared";
import { useAuthStore } from "../stores/auth";

/**
 * 应用级 HTTP/Auth 单例（05 §6 · 02 §4.3 refresh 职责下沉到这里）。
 * getAuthApi() 必须在 pinia 就绪后调用（点击/生命周期内），模块级不做全局态捕获。
 */
let cached: { bare: ReturnType<typeof createHttpClient>; auth: AuthApi } | null = null;

function baseUrl(): string {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  return env.VITE_API_BASE ?? "";
}

export function getAuthApi(): { bare: ReturnType<typeof createHttpClient>; auth: AuthApi } {
  if (cached) {
    return cached;
  }
  const store = useAuthStore();
  // bare：无自动刷新（刷新调用自身不能再进 401 刷新环）
  const bare = createHttpClient({
    baseUrl: baseUrl(),
    getAccess: () => store.accessToken,
    onAccess: (t) => store.setAccess(t),
  });
  const auth = createAuthApi(bare);
  // 带单飞刷新的业务客户端（供后续模块复用；本块先挂 auth）
  const http = createHttpClient({
    baseUrl: baseUrl(),
    getAccess: () => store.accessToken,
    onAccess: (t) => store.setAccess(t),
    refreshCall: async () => {
      const rt = store.refreshToken;
      if (!rt) {
        throw new ApiError(2001);
      }
      const res = await auth.refresh(rt);
      store.setSession({ accessToken: res.accessToken, refreshToken: res.refreshToken, userId: store.userId ?? "" });
      return res.accessToken;
    },
  });
  cached = { bare, auth: createAuthApi(http) };
  return cached;
}
