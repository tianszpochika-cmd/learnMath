/**
 * 社区 UI 纯逻辑（16W15 · 02 §5.9 后端 CommunityModeration 前端镜像；可单测）。
 * 权威边界：状态机与敏感词匹配在服务端；本模块只做可见性渲染、采纳/点赞展示、回执文案。
 */

export type PostState = "ACTIVE" | "HELD" | "REJECTED" | "TAKEN_DOWN" | "DELETED";

/** 他人可见性：仅 ACTIVE（HELD/驳回/下架/删除均不可见）。 */
export function visibleToOthers(state: PostState): boolean {
  return state === "ACTIVE";
}

/** 作者视角文案（与后端 authorView 同口径）。 */
export function authorView(state: PostState): string {
  switch (state) {
    case "ACTIVE":
      return "已发布";
    case "HELD":
      return "审核中（暂不可见）";
    case "REJECTED":
      return "未通过（含理由）";
    case "TAKEN_DOWN":
      return "已暂时下架（待处理）";
    case "DELETED":
      return "内容已删除（3402）";
  }
}

/** 列表过滤：他人视角只留 ACTIVE；作者视角可含自己的 HELD（带"审核中"徽标）。 */
export function feedFilter(
  posts: Array<{ state: PostState; mine: boolean }>,
  viewerIsAuthor: boolean,
): Array<{ index: number; state: PostState; heldBadge: boolean }> {
  const out: Array<{ index: number; state: PostState; heldBadge: boolean }> = [];
  (posts ?? []).forEach((p, index) => {
    if (p.state === "ACTIVE") {
      out.push({ index, state: p.state, heldBadge: false });
      return;
    }
    if (viewerIsAuthor && p.mine && p.state === "HELD") {
      out.push({ index, state: p.state, heldBadge: true });
    }
  });
  return out;
}

// ---------- 发帖回执（镜像 submit：命中→3401 扣留；未命中→先发后审） ----------

export interface SubmitFeedback {
  ok: boolean;
  code: number;
  message: string;
  intoReviewQueue: boolean;
}

const HIT_WORDS = ["领答案", "加v", "答案群"]; // 演示词库（服务端 AC 权威）

export function containsSensitive(text: string): { hit: boolean; words: string[] } {
  const lower = (text || "").toLowerCase();
  const words = HIT_WORDS.filter((w) => lower.includes(w));
  return { hit: words.length > 0, words };
}

export function submitFeedback(text: string): SubmitFeedback {
  const r = containsSensitive(text);
  if (r.hit) {
    return {
      ok: false,
      code: 3401,
      message: `内容命中审核词库（${r.words.join("、")}），暂不可见（3401）；你可见「审核中」`,
      intoReviewQueue: false,
    };
  }
  return {
    ok: true,
    code: 0,
    message: "已发布（先发后审，进入抽审队列）",
    intoReviewQueue: true,
  };
}

/** 举报可用性：仅 ACTIVE 可举报下架。 */
export function reportEnabled(state: PostState): boolean {
  return state === "ACTIVE";
}

/** 举报处理结论文案（镜像 handleReport）。 */
export function reportHandleMessage(founded: boolean): string {
  return founded ? "举报成立 → 删除（深链失效 3402）" : "举报不成立 → 恢复可见";
}

// ---------- 采纳与点赞 ----------

export interface AdoptView {
  label: string;
  cls: "adopted" | "available" | "disabled";
}

/** 采纳徽标：已采纳本答 → ✓；未采纳可点；已采纳他人 → 换绑禁用。 */
export function adoptView(adoptedAnswerId: string | null, answerId: string): AdoptView {
  if (adoptedAnswerId === null) {
    return { label: "采纳", cls: "available" };
  }
  if (adoptedAnswerId === answerId) {
    return { label: "✓ 已采纳", cls: "adopted" };
  }
  return { label: "已有采纳", cls: "disabled" };
}

export interface LikeView {
  icon: string;
  count: number;
}

export function likeView(count: number, liked: boolean): LikeView {
  return { icon: liked ? "♥" : "♡", count: Math.max(0, count) };
}

export function duplicateLikeMessage(): string {
  return "请勿重复点赞（3403）";
}

// ---------- 列表与回复 ----------

export interface PostCard {
  id: number;
  title: string;
  author: string;
  timeLabel: string;
  topic?: string;
  replyCount: number;
  likeCount: number;
  adopted?: boolean;
}

export type FeedTab = "latest" | "essence" | "topic";

export function filterFeed(posts: PostCard[], tab: FeedTab, topic?: string): PostCard[] {
  const src = posts ?? [];
  switch (tab) {
    case "essence":
      return src.filter((p) => p.adopted === true || p.likeCount >= 40);
    case "topic":
      return topic ? src.filter((p) => p.topic === topic) : [...src];
    case "latest":
    default:
      return [...src];
  }
}

export interface Reply {
  id: number;
  author: string;
  content: string;
  adopted: boolean;
  likeCount: number;
}

/** 回复排序：**已采纳置顶** → 赞数降序（稳定）。 */
export function sortedReplies(replies: Reply[]): Reply[] {
  return [...(replies ?? [])].sort((a, b) => {
    if (a.adopted !== b.adopted) {
      return a.adopted ? -1 : 1;
    }
    return b.likeCount - a.likeCount;
  });
}

export function postPath(id: number | string): string {
  return `/community/post/${id}`;
}

export const ASK_PATH = "/community/ask";
