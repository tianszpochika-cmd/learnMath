import { createSseParser, type SseEvent } from "@learnmath/shared";

/**
 * AI 面板与全屏搜索 UI 纯逻辑（16W18 · WD6 · 02 §5.8/E5 · 04 SSE 前端消费；可单测）。
 * SSE 解析复用 shared.createSseParser（分块/CRLF/[DONE] 已单测）；本模块为**状态机与展示映射**。
 */

// ---------- AI 会话状态机 ----------

export type AiStatus = "idle" | "streaming" | "done" | "error";

export interface AiMsg {
  role: "user" | "ai";
  content: string;
}

export interface AiState {
  status: AiStatus;
  enabled: boolean; // Provider 开关（false → 3100 入口隐藏）
  errorCode: number | null;
  msgs: AiMsg[];
}

export type AiEvent =
  | { type: "send"; text: string }
  | { type: "frame"; frame: SseEvent }
  | { type: "parse-error"; code: number; message?: string }
  | { type: "reset" }
  | { type: "toggle-enabled" };

export function initialAiState(enabled = true): AiState {
  return { status: "idle", enabled, errorCode: null, msgs: [] };
}

/**
 * 纯 reducer：驱动 UI（测试直接喂事件序列）。
 * - disabled 时 send → 3100（入口本应隐藏，防御性保留）；
 * - message 帧追加到"正在生成"的 AI 消息（无则创建）；
 * - done / data:[DONE] → done；error 帧 → error + code；
 * - 未知事件类型忽略。
 */
export function reduceAi(state: AiState, ev: AiEvent): AiState {
  switch (ev.type) {
    case "toggle-enabled": {
      if (state.enabled) {
        return { ...initialAiState(false) };
      }
      return initialAiState(true);
    }
    case "send": {
      if (!state.enabled) {
        return { ...state, status: "error", errorCode: 3100 };
      }
      if (state.status === "streaming") {
        return state; // 生成中不重复发
      }
      const text = ev.text.trim();
      if (!text) {
        return state;
      }
      return {
        ...state,
        status: "streaming",
        errorCode: null,
        msgs: [...state.msgs, { role: "user", content: text }, { role: "ai", content: "" }],
      };
    }
    case "frame": {
      if (!state.enabled) {
        return state;
      }
      const f = ev.frame;
      if (f.data === "[DONE]") {
        return { ...state, status: state.status === "streaming" ? "done" : state.status };
      }
      if (f.event === "error") {
        const m = /"code"\s*:\s*(\d+)/.exec(f.data);
        return { ...state, status: "error", errorCode: m ? Number(m[1]) : 5000 };
      }
      if (f.event === "done") {
        return { ...state, status: state.status === "streaming" ? "done" : state.status };
      }
      if (f.event === "message" && state.status === "streaming") {
        const delta = extractDelta(f.data);
        const msgs = [...state.msgs];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "ai") {
          msgs[msgs.length - 1] = { ...last, content: last.content + delta };
        }
        return { ...state, msgs };
      }
      return state;
    }
    case "parse-error":
      return { ...state, status: "error", errorCode: ev.code };
    case "reset":
      return initialAiState(state.enabled);
    default:
      return state;
  }
}

/** 从 message 帧 data 提取 delta 文本（支持 {"delta":"x"} 或纯文本）。 */
export function extractDelta(data: string): string {
  const m = /"delta"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(data);
  if (m) {
    return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  if (data.startsWith("{")) {
    return "";
  }
  return data;
}

// ---------- 模式与配额（镜像后端 AiGateway） ----------

export type AiMode = "SOCRATIC" | "DIRECT";

export function resolveMode(requested: AiMode | null | undefined): AiMode {
  return requested ?? "SOCRATIC"; // E5 默认苏格拉底
}

export function modeDirective(m: AiMode): string {
  return m === "DIRECT"
    ? "直接讲解：给出完整解答步骤并标注依据"
    : "苏格拉底：一次只问一个问题，引导用户自己发现下一步（默认不给答案）";
}

/** 对话成本（前 3 次免费 → 5 分；镜像 PointsRules.aiChatCost）。 */
export function chatCostFront(usedToday: number): number {
  return usedToday < 3 ? 0 : 5;
}

export const LIMITED_TEXT = "AI 次数或积分不足（3101）";
export const DISABLED_TEXT = "AI 未启用（3100）";

/** 上下文标签（D5：全局浮层 vs 题面唤起带题上下文）。 */
export function contextLabel(subject?: { type: "question" | "formula"; id: number | string; title?: string } | null): string {
  if (!subject) {
    return "AI 导师 · 全局（无题目上下文）";
  }
  const t = subject.type === "formula" ? "公式" : "题目";
  return `上下文：${t} #${subject.id}${subject.title ? " · " + subject.title : ""}`;
}

export function quickAsks(): string[] {
  return ["为什么不能两边同除 (x−2)？", "给我出两道同类题"];
}

// ---------- 全屏搜索（W18 · 分组投影） ----------

export interface SearchDoc {
  type: "course" | "question" | "node" | "formula" | "post";
  id: number;
  name: string;
  sub?: string;
}

export interface SearchGroup {
  key: SearchDoc["type"];
  label: string;
  items: SearchDoc[];
  total: number;
}

const GROUP_LABEL: Record<SearchDoc["type"], string> = {
  course: "课程",
  question: "题目",
  node: "知识点",
  formula: "公式",
  post: "帖子",
};

export const SEARCH_SUGGESTIONS = ["正弦起源", "判别式", "根的分布"];

function matches(doc: SearchDoc, q: string): boolean {
  return doc.name.toLowerCase().includes(q) || (doc.sub ?? "").toLowerCase().includes(q);
}

/** 分组搜索：trim+小写；每组最多展示 3 条，total 保留全数；全空 → 空组剔除。 */
export function searchGroups(corpus: SearchDoc[], rawQuery: string, perGroup = 3): SearchGroup[] {
  const q = (rawQuery || "").trim().toLowerCase();
  if (!q) {
    return [];
  }
  const byType = new Map<SearchDoc["type"], SearchDoc[]>();
  for (const d of corpus ?? []) {
    if (matches(d, q)) {
      const list = byType.get(d.type) ?? [];
      list.push(d);
      byType.set(d.type, list);
    }
  }
  const order: SearchDoc["type"][] = ["node", "formula", "question", "course", "post"];
  const out: SearchGroup[] = [];
  for (const t of order) {
    const items = byType.get(t);
    if (items && items.length > 0) {
      out.push({ key: t, label: GROUP_LABEL[t], items: items.slice(0, perGroup), total: items.length });
    }
  }
  return out;
}

export function searchEmptyState(hasQuery: boolean): string {
  if (!hasQuery) {
    return "试试：正弦起源 / 判别式 / 根的分布";
  }
  return "无结果 —— 换个关键词，或试试推荐词";
}

/** 类型 → 路径（searchPath 与路由表同口径）。 */
export function searchPath(doc: Pick<SearchDoc, "type" | "id">): string {
  switch (doc.type) {
    case "course":
      return `/paths/course/${doc.id}`;
    case "question":
      return `/deepdive/question/${doc.id}`;
    case "node":
      return `/graph/node/${doc.id}`;
    case "formula":
      return `/formulas/${doc.id}`;
    case "post":
      return `/community/post/${doc.id}`;
    default:
      return "/";
  }
}

/** 便捷：shared 解析器再导出（面板直挂 EventSource/fetch 流用）。 */
export { createSseParser };
