import { getAppHttp } from "./client";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => value && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const str = (value: unknown): string => typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
export type NotificationType = "SYSTEM" | "LEARNING" | "COMMUNITY" | "MODERATION";
export interface Notice { id: string; type: NotificationType; title: string; createdAt: string; read: boolean }
export interface AccountView { nickname: string; status: string; deletionDueAt: string }

export function projectNotices(value: unknown): Notice[] {
  const source = obj(value);
  const raw = Array.isArray(value) ? value : Array.isArray(source.items) ? source.items : Array.isArray(source.records) ? source.records : [];
  return raw.map((entry): Notice | null => {
    const item = obj(entry);
    const type = str(item.type ?? item.category).toUpperCase();
    const id = str(item.id);
    const title = str(item.title);
    return /^[a-zA-Z0-9-]{1,80}$/.test(id) && ["SYSTEM", "LEARNING", "COMMUNITY", "MODERATION"].includes(type) && title
      ? { id, type: type as NotificationType, title, createdAt: str(item.createdAt), read: item.read === true }
      : null;
  }).filter((item): item is Notice => item !== null);
}

export function projectAccount(value: unknown): AccountView {
  const source = obj(value);
  return { nickname: str(source.nickname), status: str(source.accountStatus ?? source.status), deletionDueAt: str(source.deletionDueAt) };
}

export async function readNotices(): Promise<Notice[]> {
  return projectNotices(await getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/notifications", query: { page: 1, size: 50 } }));
}
export async function readAccount(): Promise<AccountView> {
  return projectAccount(await getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/user/profile" }));
}
export async function markNoticesRead(ids: string[]): Promise<void> {
  if (!ids.length || ids.some((id) => !/^[a-zA-Z0-9-]{1,80}$/.test(id))) return;
  await getAppHttp().request<unknown>({ method: "POST", path: "/api/app/v1/notifications/read", body: { ids } });
}
export async function requestDataExport(): Promise<void> {
  await getAppHttp().request<unknown>({ method: "POST", path: "/api/app/v1/user/export" });
}
export async function cancelAccountDeletion(): Promise<void> {
  await getAppHttp().request<unknown>({ method: "POST", path: "/api/app/v1/user/account/cancel" });
}
