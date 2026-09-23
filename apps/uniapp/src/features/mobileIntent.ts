import { createNavigationIntentApi } from "@learnmath/api-client";
import { clearResumeToken, getResumeToken } from "./entryFlow";
import { getMobileHttp } from "../services/mobileClient";

export function resolveMobileTarget(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const target = value as Record<string, unknown>;
  const kind = target.targetType ?? target.type;
  const id = target.targetId ?? target.id ?? target.slug;
  const normalized = typeof id === "number" && Number.isSafeInteger(id) ? String(id) : id;
  if (typeof normalized !== "string" || !/^[A-Za-z0-9-]{1,80}$/.test(normalized)) return null;
  if (kind === "node") return "/pages/learn/node/index?id=" + encodeURIComponent(normalized);
  if (kind === "question") return "/pages/learn/deepdive/index?subjectType=question&subjectId=" + encodeURIComponent(normalized);
  return null;
}
function navigate(url: string): Promise<boolean> {
  return new Promise((resolve) => uni.navigateTo({ url, success: () => resolve(true), fail: () => resolve(false) }));
}
export async function restoreMobileTarget(): Promise<{ attempted: boolean; opened: boolean; message: string }> {
  const token = getResumeToken();
  if (!token) return { attempted: false, opened: false, message: "" };
  try {
    const api = createNavigationIntentApi(getMobileHttp());
    const intent = await api.redeem(token);
    const url = resolveMobileTarget(intent.target);
    if (!url) {
      clearResumeToken();
      return { attempted: true, opened: false, message: "原目标已核对，但此端暂无对应页面。请回原页面查看试做输入，或从路径中心重新进入。" };
    }
    if (!await navigate(url)) return { attempted: true, opened: false, message: "目标暂时无法打开。原试做输入未被自动提交，可返回原页面复制。" };
    clearResumeToken();
    try { await api.consume(intent.resumeId); } catch { /* no false consumption claim */ }
    return { attempted: true, opened: true, message: "" };
  } catch (cause) {
    const text = cause instanceof Error ? cause.message : "";
    return { attempted: true, opened: false, message: /过期|失效|3012/.test(text)
      ? "继续学习目标已过期或下架。原试做输入未被自动提交。"
      : "暂时无法恢复原学习目标。请稍后重试，或从路径中心重新进入。" };
  }
}
