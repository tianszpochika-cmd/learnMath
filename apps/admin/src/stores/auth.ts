import { defineStore } from "pinia";

/** 管理域会话（独立于学员域；access 不落盘、refresh 落盘 —— 02 §4.3 双域）。 */
interface AdminAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  adminName: string | null;
}

const KEY = "lm.admin.auth";

function load(): AdminAuthState {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null, adminName: null };
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AdminAuthState>;
      return { accessToken: null, refreshToken: p.refreshToken ?? null, adminName: p.adminName ?? null };
    }
  } catch {
    /* 脏数据忽略 */
  }
  return { accessToken: null, refreshToken: null, adminName: null };
}

function persist(s: AdminAuthState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ accessToken: null, refreshToken: s.refreshToken, adminName: s.adminName }),
    );
  } catch {
    /* 隐私模式忽略 */
  }
}

export const useAdminAuthStore = defineStore("admin-auth", {
  state: (): AdminAuthState => load(),
  getters: {
    isAuthenticated: (s): boolean => Boolean(s.accessToken || s.refreshToken),
  },
  actions: {
    setSession(p: { accessToken: string; refreshToken: string; adminName: string }) {
      this.accessToken = p.accessToken;
      this.refreshToken = p.refreshToken;
      this.adminName = p.adminName;
      persist(this.$state);
    },
    clear() {
      this.accessToken = null;
      this.refreshToken = null;
      this.adminName = null;
      persist(this.$state);
    },
  },
});
