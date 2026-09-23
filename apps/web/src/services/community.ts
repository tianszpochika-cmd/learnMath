import { getAppHttp } from "./client";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => value && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const str = (value: unknown): string => typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
const num = (value: unknown): number | null => { const n = Number(value); return value === null || value === undefined || value === "" || !Number.isFinite(n) ? null : n; };
const validId = (id: string): boolean => /^[a-zA-Z0-9-]{1,80}$/.test(id);

export interface CommunityReply { id: string; author: string; content: string; createdAt: string; likeCount: number | null; adopted: boolean; canAccept: boolean }
export interface CommunityPost { id: string; title: string; content: string; author: string; topic: string; createdAt: string; replyCount: number | null; likeCount: number | null; featured: boolean; status: string; questionId: string; replies: CommunityReply[] }
export interface CommunityPage { posts: CommunityPost[]; total: number | null }

function reply(value: unknown): CommunityReply | null {
  const item = obj(value);
  const id = str(item.id);
  if (!validId(id) || !str(item.content)) return null;
  return { id, author: str(item.authorName ?? item.author) || "学习者", content: str(item.content), createdAt: str(item.createdAt), likeCount: num(item.likeCount), adopted: item.adopted === true || item.accepted === true, canAccept: item.canAccept === true };
}

export function projectPost(value: unknown): CommunityPost | null {
  const item = obj(value);
  const id = str(item.id);
  if (!validId(id) || !str(item.title)) return null;
  const rawReplies = Array.isArray(item.replies) ? item.replies : [];
  return {
    id,
    title: str(item.title),
    content: str(item.content ?? item.body),
    author: str(item.authorName ?? item.author) || "学习者",
    topic: str(item.topicName ?? item.topic),
    createdAt: str(item.createdAt),
    replyCount: num(item.replyCount),
    likeCount: num(item.likeCount),
    featured: item.featured === true || item.essence === true,
    status: str(item.status).toUpperCase(),
    questionId: str(item.questionId),
    replies: rawReplies.map(reply).filter((entry): entry is CommunityReply => entry !== null).sort((a, b) => Number(b.adopted) - Number(a.adopted)),
  };
}

export function projectCommunityPage(value: unknown): CommunityPage {
  const source = obj(value);
  const raw = Array.isArray(value) ? value : Array.isArray(source.items) ? source.items : Array.isArray(source.records) ? source.records : [];
  return { posts: raw.map(projectPost).filter((post): post is CommunityPost => post !== null && post.status === "ACTIVE"), total: num(source.total) };
}

export async function readCommunity(page = 1, size = 20): Promise<CommunityPage> {
  return projectCommunityPage(await getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/community/posts", query: { page, size } }));
}
export async function readPost(id: string): Promise<CommunityPost | null> {
  if (!validId(id)) throw new Error("帖子编号无效");
  const post = projectPost(await getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/community/posts/" + id }));
  return post?.status === "ACTIVE" ? post : null;
}
export async function createPost(title: string, content: string): Promise<CommunityPost | null> {
  return projectPost(await getAppHttp().request<unknown>({ method: "POST", path: "/api/app/v1/community/posts", body: { title, content } }));
}
export async function createReply(id: string, content: string): Promise<void> {
  if (!validId(id)) throw new Error("帖子编号无效");
  await getAppHttp().request<unknown>({ method: "POST", path: "/api/app/v1/community/posts/" + id + "/replies", body: { content } });
}
export async function likeCommunity(type: "post" | "reply", id: string): Promise<void> {
  if (!validId(id)) throw new Error("内容编号无效");
  await getAppHttp().request<unknown>({ method: "POST", path: `/api/app/v1/community/${type}/${id}/like` });
}
export async function acceptReply(id: string): Promise<void> {
  if (!validId(id)) throw new Error("回复编号无效");
  await getAppHttp().request<unknown>({ method: "POST", path: `/api/app/v1/community/replies/${id}/accept` });
}
