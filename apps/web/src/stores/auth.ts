import { defineStore } from "pinia";

/**
 * 认证态（05 §7 · BR-09：登录后走 resolveAfterLogin(redirect) 回目标）。
 * token 持久化在 localStorage（刷新保留）；登出清空。
 */
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
}

const KEY = "lm.auth";

function load(): AuthState {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null, userId: null };
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AuthState>;
      // access 短寿不落盘（持久化时已置 null）；此处显式取字段避免键覆盖告警
      return {
        accessToken: null,
        refreshToken: parsed.refreshToken ?? null,
        userId: parsed.userId ?? null,
      };
    }
  } catch {
    /* 忽略脏数据 */
  }
  return { accessToken: null, refreshToken: null, userId: null };
}

function persist(state: AuthState): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ accessToken: null, refreshToken: state.refreshToken, userId: state.userId }),
    );
  } catch {
    /* 隐私模式忽略 */
  }
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => load(),
  getters: {
    isAuthenticated: (s): boolean => Boolean(s.accessToken || s.refreshToken),
  },
  actions: {
    setSession(p: { accessToken: string; refreshToken: string; userId: string }) {
      this.accessToken = p.accessToken;
      this.refreshToken = p.refreshToken;
      this.userId = p.userId;
      persist(this.$state);
    },
    setAccess(token: string | null) {
      this.accessToken = token;
    },
    clear() {
      this.accessToken = null;
      this.refreshToken = null;
      this.userId = null;
      persist(this.$state);
    },
  },
});
