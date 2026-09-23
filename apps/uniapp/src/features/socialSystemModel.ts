import { arrayValue, numberValue, stringValue } from "./mobileData";

export type Data = Record<string, unknown>;
export const obj = (value: unknown): Data => value && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
export const list = (value: unknown, ...keys: string[]): unknown[] | null => arrayValue(value, ...keys);
export const txt = (value: unknown): string => stringValue(value) || (typeof value === "number" && Number.isFinite(value) ? String(value) : "");
export const num = numberValue;
export const safeId = (value: unknown): string => /^[a-zA-Z0-9-]{1,80}$/.test(txt(value)) ? txt(value) : "";
export function postStatus(value: unknown): "ACTIVE" | "PENDING" | "DELETED" | "REJECTED" | "UNKNOWN" {
  const status = txt(value).toUpperCase();
  return status === "2" || status === "ACTIVE" || status === "APPROVED" ? "ACTIVE" : status === "1" || status === "PENDING" || status === "HELD" ? "PENDING" : status === "3" || status === "DELETED" ? "DELETED" : status === "4" || status === "REJECTED" ? "REJECTED" : "UNKNOWN";
}
export const visiblePost = (status: string, own = false): boolean => status === "ACTIVE" || (own && status === "PENDING");
export const readable = (value: unknown): string => typeof value === "string" ? value : "";
export const pageRows = (value: unknown, ...keys: string[]): unknown[] | null => list(value, ...keys, "items", "records", "list", "content");

export interface CheckinView { checked: boolean | null; streak: number | null; days: { date: string; state: "checked" | "makeup" | "missed" }[]; makeUpCards: number | null }
export function checkinView(raw: unknown): CheckinView | null {
  const data = obj(raw);
  if (!Object.keys(data).length) return null;
  const checked = data.checkedToday ?? data.todayChecked ?? data.checked;
  const days = pageRows(data, "calendar", "days")?.map((item) => {
    const row = obj(item), date = txt(row.date ?? row.day);
    const rawState = txt(row.state ?? row.status).toLowerCase();
    const state = rawState === "checked" || row.checked === true ? "checked" : rawState === "makeup" ? "makeup" : rawState === "missed" ? "missed" : null;
    return date && state ? { date, state } : null;
  }).filter((item): item is CheckinView["days"][number] => item !== null) ?? [];
  return { checked: typeof checked === "boolean" ? checked : null, streak: num(data.streak ?? data.consecutiveDays), days, makeUpCards: num(data.makeUpCards ?? data.makeupCards) };
}

export interface PointEntry { id: string; title: string; amount: number; at: string }
export function pointsView(raw: unknown): { balance: number | null; rows: PointEntry[] } | null {
  const data = obj(raw), entries = pageRows(data, "transactions", "entries", "details");
  if (entries === null) return null;
  return { balance: num(data.balance ?? data.points ?? data.totalPoints), rows: entries.map((entry) => {
    const row = obj(entry), amount = num(row.amount ?? row.delta);
    return amount === null ? null : { id: safeId(row.id) || `${txt(row.createdAt)}-${amount}`, title: txt(row.title ?? row.reason ?? row.description) || "积分变动", amount, at: txt(row.createdAt ?? row.time) };
  }).filter((entry): entry is PointEntry => entry !== null) };
}

export interface RankEntry { id: string; nickname: string; tier: string; score: number | null; position: number | null; mine: boolean }
export function rankView(raw: unknown): RankEntry[] | null {
  const entries = pageRows(raw, "rankings", "ranking", "leaders");
  if (entries === null) return null;
  return entries.map((entry) => {
    const row = obj(entry);
    return { id: safeId(row.id ?? row.userId), nickname: txt(row.anonymousName ?? row.maskedName) || "匿名同学", tier: txt(row.rankTier ?? row.tier), score: num(row.score ?? row.points), position: num(row.position ?? row.rank), mine: row.mine === true || row.isSelf === true };
  });
}

export interface PostView { id: string; title: string; content: string; author: string; status: string; own: boolean; replies: { id: string; author: string; content: string; accepted: boolean }[] }
export function postView(raw: unknown, viewerId = ""): PostView | null {
  const outer = obj(raw), row = Object.keys(obj(outer.post)).length ? obj(outer.post) : outer;
  const id = safeId(row.id ?? row.postId), status = postStatus(row.status);
  if (!id || status === "UNKNOWN") return null;
  const own = row.mine === true || row.isOwner === true || Boolean(viewerId && viewerId === safeId(row.userId ?? row.authorId));
  if (!visiblePost(status, own)) return null;
  const replies = pageRows(outer, "replies") ?? pageRows(row, "replies") ?? [];
  return { id, title: txt(row.title), content: readable(row.content ?? row.body), author: txt(row.authorName ?? obj(row.author).nickname) || "匿名同学", status, own,
    replies: replies.map((entry) => { const reply = obj(entry); return postStatus(reply.status) === "ACTIVE" ? { id: safeId(reply.id), author: txt(reply.authorName ?? obj(reply.author).nickname) || "匿名同学", content: readable(reply.content), accepted: reply.accepted === true || reply.accepted === 1 } : null; }).filter((reply): reply is PostView["replies"][number] => reply !== null && !!reply.id && !!reply.content) };
}

export interface NoticeView { id: string; title: string; body: string; type: string; at: string; read: boolean; refType: string; refId: string; link: string }
export function noticeType(value: unknown): string {
  const type = txt(value).toLowerCase();
  return ({ "1": "system", "2": "learning", "3": "community", "4": "audit" } as Record<string, string>)[type] ?? type;
}
export function noticesView(raw: unknown): NoticeView[] | null {
  const entries = pageRows(raw, "notifications", "notices");
  if (entries === null) return null;
  return entries.map((entry) => { const row = obj(entry); return { id: safeId(row.id), title: txt(row.title) || "一条新通知", body: readable(row.content ?? row.body), type: noticeType(row.type), at: txt(row.createdAt), read: row.read === true || row.read === 1 || row.isRead === true || row.readAt != null, refType: txt(row.refType), refId: safeId(row.refId), link: txt(row.link) }; }).filter((entry) => entry.id);
}

export function noticeTarget(row: NoticeView): string | null {
  if (row.refId && row.refType === "post") return `/pages/social/post/index?id=${row.refId}`;
  if (row.refId && row.refType === "attempt") return `/pages/attempt/report/index?id=${row.refId}`;
  if (row.refId && row.refType === "course") return `/pages/learn/course/index?id=${row.refId}`;
  const match = /^\/(?:api\/app\/v1\/)?(community\/posts|attempts|courses)\/([a-zA-Z0-9-]{1,80})$/.exec(row.link);
  if (match) return ({ "community/posts": "/pages/social/post/index", attempts: "/pages/attempt/report/index", courses: "/pages/learn/course/index" } as Record<string, string>)[match[1]] + `?id=${match[2]}`;
  const local = /^\/(pages\/(?:social\/post|attempt\/report|learn\/course)\/index)\?id=([a-zA-Z0-9-]{1,80})$/.exec(row.link);
  if (local) return `/${local[1]}?id=${local[2]}`;
  return null;
}

export interface SearchEntry { id: string; title: string; description: string; type: string; target: string | null }
export function searchView(raw: unknown): SearchEntry[] | null {
  const entries = pageRows(raw, "results", "hits");
  if (entries === null) return null;
  return entries.map((entry) => {
    const row = obj(entry), id = safeId(row.id), type = txt(row.type), title = txt(row.title ?? row.name ?? row.stem);
    const target = !id ? null : type === "course" ? `/pages/learn/course/index?id=${id}` : type === "post" ? `/pages/social/post/index?id=${id}` : type === "node" ? `/pages/learn/node/index?id=${id}` : type === "topic" ? `/pages/path/topic/index?id=${id}` : null;
    return { id, title, description: readable(row.summary ?? row.description), type, target };
  }).filter((entry) => entry.id && entry.title);
}

export function deletionView(raw: unknown): { state: "active" | "cooling" | "deleted" | "unknown"; deadline: string } {
  const row = obj(raw), account = obj(row.account), profile = obj(row.profile), user = obj(row.user);
  const source = Object.keys(account).length ? account : Object.keys(profile).length ? profile : Object.keys(user).length ? user : row;
  const state = txt(source.accountStatus ?? source.deletionStatus ?? source.status).toLowerCase();
  return { state: ["3", "cooling", "pending_deletion", "deletion_pending"].includes(state) ? "cooling" : ["4", "deleted"].includes(state) ? "deleted" : ["1", "active", "normal", "cancelled"].includes(state) ? "active" : "unknown", deadline: txt(source.deletionAt ?? source.deleteAt ?? source.coolingEndsAt ?? source.deletionEffectiveAt) };
}
