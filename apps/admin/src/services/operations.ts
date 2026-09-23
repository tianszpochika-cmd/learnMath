import type { HttpClient } from "@learnmath/api-client";
import { getAdminHttp } from "./client";
import { useAdminAuthStore } from "../stores/auth";

export type RecordValue = Record<string, unknown>;
export interface PageResult { items: RecordValue[]; total: number | null }
export const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
export const label = (value: unknown): string => typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
export const measure = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
export const safeId = (value: unknown): string => {
  const id = label(value);
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error("记录编号无效");
  return id;
};

/** Unknown shapes are shown as unavailable; no sample records or made-up totals. */
export function pageResult(value: unknown): PageResult {
  const source = record(value);
  const raw = Array.isArray(value) ? value : Array.isArray(source.items) ? source.items : Array.isArray(source.records) ? source.records : [];
  return { items: raw.map(record).filter((item) => Object.keys(item).length > 0), total: measure(source.total) };
}

export function displayValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "是" : "否";
  return label(value) || "—";
}

export function publicConfigEntries(value: unknown): Array<{ key: string; value: string }> {
  return Object.entries(record(value))
    .filter(([key, entry]) => !/(secret|password|token|api.?key|private|credential)/i.test(key)
      && (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean"))
    .map(([key, entry]) => ({ key, value: displayValue(entry) }));
}

export function userStatusLabel(value: unknown): string {
  const status = typeof value === "number" ? value : Number(value);
  return status === 1 ? "正常" : status === 2 ? "已禁用" : status === 3 ? "注销冷静期" : status === 4 ? "已注销" : displayValue(value);
}

export function createOperationsApi(client: HttpClient = getAdminHttp()) {
  const base = "/api/admin/v1";
  const get = (path: string, query?: Record<string, string | number | undefined>) => client.request<unknown>({ method: "GET", path: base + path, query });
  return {
    async users(page = 1, keyword = "") { return pageResult(await get("/users", { page, size: 20, keyword: keyword || undefined })); },
    async user(id: string) { return record(await get("/users/" + safeId(id))); },
    async setUserStatus(id: string, status: "enabled" | "disabled", reason: string) {
      if (!reason.trim()) throw new Error("请填写操作原因");
      return client.request<unknown>({ method: "PATCH", path: base + "/users/" + safeId(id) + "/status", body: { status: status === "enabled" ? 1 : 2, reason: reason.trim() } });
    },
    async communityQueue(page = 1, kind = "pending") { return pageResult(await get("/community/queue", { page, size: 20, type: kind })); },
    async audit(type: "post" | "reply", id: string, action: "approve" | "delete" | "reject", reason: string) {
      if (action !== "approve" && !reason.trim()) throw new Error("删除或驳回需要填写原因");
      return client.request<unknown>({ method: "PATCH", path: base + `/community/${type}/${safeId(id)}/audit`, body: { action, reason: reason.trim() } });
    },
    async usage() { return record(await get("/ai/usage")); },
    async stats(kind: "overview" | "paths" | "content" | "learners") { return await get("/stats/" + kind); },
    async configs() { return record(await get("/configs")); },
    async oplogs(page = 1, operator = "", action = "") { return pageResult(await get("/oplogs", { page, size: 20, operator: operator || undefined, action: action || undefined })); },
  };
}

export async function downloadStatsCsv(report: "overview" | "paths" | "content" | "learners", from: string, to: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new Error("请选择有效的日期范围");
  const token = useAdminAuthStore().accessToken;
  if (!token) throw new Error("管理会话已失效，请重新登录");
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  const origin = (env.VITE_ADMIN_API_BASE ?? env.VITE_API_BASE ?? "").trim().replace(/\/+$/, "").replace(/\/api\/admin\/v1$/i, "");
  const query = new URLSearchParams({ report, from, to });
  const response = await fetch(`${origin}/api/admin/v1/stats/export?${query}`, { headers: { authorization: `Bearer ${token}`, accept: "text/csv" } });
  if (!response.ok || !response.headers.get("content-type")?.includes("text/csv")) throw new Error("服务端没有返回可下载的 CSV 文件");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `learnmath-${report}-${from}-${to}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
