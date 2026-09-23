import type { RouteLocationNormalized, RouteLocationRaw } from "vue-router";

/**
 * 登录守卫与 BR-09 目标路由投影。服务端只给白名单目标，前端也只
 * 拼接自己认识的站内路由；绝不执行响应中的任意 URL。
 */

export interface GuardDeps {
  isAuthenticated(): boolean;
}

/** 登录成功后的普通 redirect，仅接受站内相对路径。 */
export function resolveAfterLogin(redirect: string | null | undefined): string {
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(redirect) || /^\/login(?:[/?#]|$)/i.test(redirect)) return "/";
  return redirect;
}

export function readResumeToken(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 512 || /[\s\u0000-\u001f]/.test(value)) return null;
  return value;
}

/** Only these target types currently have an exact Web destination. */
export function resolveResumeTarget(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const target = value as Record<string, unknown>;
  const kind = target.targetType ?? target.type;
  const rawId = target.targetId ?? target.id ?? target.slug;
  const id = typeof rawId === "number" && Number.isSafeInteger(rawId) ? String(rawId) : rawId;
  if (typeof id !== "string" || !/^[A-Za-z0-9-]{1,80}$/.test(id)) return null;
  if (kind === "node") return "/graph/node/" + id;
  if (kind === "formula") return "/formulas/" + id;
  if (kind === "question") return "/deepdive/question/" + id;
  // There is no exact event or path destination in the current Web route table.
  return null;
}

/** 路由守卫主逻辑。返回 null = 放行。 */
export function resolveGuard(to: RouteLocationNormalized, deps: GuardDeps): RouteLocationRaw | null {
  const requiresAuth = to.meta.requiresAuth === true;
  if (requiresAuth && !deps.isAuthenticated()) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.name === "login" && deps.isAuthenticated()) {
    // A logged-in visitor arriving from the official site must redeem the token
    // in W01 before any redirect. resumeError keeps failure guidance visible.
    if ("resumeToken" in to.query || "resumeError" in to.query) return null;
    const redirect = typeof to.query.redirect === "string" ? to.query.redirect : null;
    return resolveAfterLogin(redirect);
  }
  return null;
}
