import { getMobileHttp } from "./mobileClient";
import { id } from "../features/attempt/attemptModel";

const root = "/api/app/v1";
const get = (path: string, query?: Record<string, string | number>) => getMobileHttp().request<unknown>({ method: "GET", path: root + path, query });
const post = (path: string, body?: Record<string, unknown>) => getMobileHttp().request<unknown>({ method: "POST", path: root + path, body });

export const socialSystemApi = {
  checkin: () => get("/checkin"),
  submitCheckin: () => post("/checkin"),
  points: (page: number) => get("/points", { page, size: 20 }),
  rank: (period: "weekly" | "daily") => get(`/rank/${period}`),
  challenges: () => get("/challenges"),
  createPost: (title: string, content: string) => post("/community/posts", { title, content }),
  post: (postId: string) => get(`/community/posts/${id(postId)}`),
  reply: (postId: string, content: string) => post(`/community/posts/${id(postId)}/replies`, { content }),
  likePost: (postId: string) => post(`/community/post/${id(postId)}/like`),
  aiStatus: () => get("/ai/status"),
  conversations: () => get("/ai/conversations"),
  conversation: (conversationId: string) => get(`/ai/conversations/${id(conversationId)}`),
  notices: (page: number, type?: string) => get("/notifications", { page, size: 20, ...(type ? { type } : {}) }),
  readNotices: (ids: string[]) => post("/notifications/read", { ids }),
  search: (q: string, type: SearchType) => get("/search", { q, type }),
  legal: (type: "terms" | "privacy") => get(`/legal/${type}`),
  exportData: () => post("/user/export"),
  cancelDeletion: () => post("/user/account/cancel"),
  profile: () => get("/user/profile"),
};

export type SearchType = "all" | "course" | "question" | "node" | "topic" | "post";
