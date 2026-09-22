import { describe, expect, it } from "vitest";
import {
  DISABLED_TEXT,
  LIMITED_TEXT,
  SEARCH_SUGGESTIONS,
  chatCostFront,
  contextLabel,
  extractDelta,
  initialAiState,
  modeDirective,
  quickAsks,
  reduceAi,
  resolveMode,
  searchEmptyState,
  searchGroups,
  searchPath,
  type AiEvent,
  type SearchDoc,
} from "./aiPanel";

function feed(events: AiEvent[]) {
  let s = initialAiState();
  for (const e of events) {
    s = reduceAi(s, e);
  }
  return s;
}

describe("AI 会话状态机（WD6 · SSE 消费）", () => {
  it("send → streaming 建 AI 消息；生成中重复 send 被忽略；空文本忽略", () => {
    let s = reduceAi(initialAiState(), { type: "send", text: " 帮我讲这步 " });
    expect(s.status).toBe("streaming");
    expect(s.msgs.map((m) => m.role)).toEqual(["user", "ai"]);
    expect(s.msgs[1].content).toBe("");

    const again = reduceAi(s, { type: "send", text: "再来一句" });
    expect(again).toBe(s), "streaming 中不重入";

    expect(reduceAi(s, { type: "send", text: "   " })).toBe(s);
  });

  it("message 帧累加 delta；done/[DONE] → done", () => {
    const s1 = feed([
      { type: "send", text: "讲讲" },
      { type: "frame", frame: { event: "message", data: '{"delta":"零因"}' } },
      { type: "frame", frame: { event: "message", data: '{"delta":"子律"}' } },
    ]);
    expect(s1.msgs[1].content).toBe("零因子律");
    expect(s1.status).toBe("streaming");

    const done1 = reduceAi(s1, { type: "frame", frame: { event: "done", data: "{}" } });
    expect(done1.status).toBe("done");

    const done2 = reduceAi(s1, { type: "frame", frame: { event: "message", data: "[DONE]" } });
    expect(done2.status).toBe("done"), "data:[DONE] 也终结";
  });

  it("error 帧带 code；parse-error 走 3102；disabled send → 3100", () => {
    const streaming = feed([{ type: "send", text: "x" }]);
    const err = reduceAi(streaming, {
      type: "frame",
      frame: { event: "error", data: '{"code":3102,"message":"upstream"}' },
    });
    expect(err.status).toBe("error");
    expect(err.errorCode).toBe(3102);

    const pe = reduceAi(streaming, { type: "parse-error", code: 3102 });
    expect(pe.errorCode).toBe(3102);

    const off = reduceAi(initialAiState(false), { type: "send", text: "hi" });
    expect(off.status).toBe("error");
    expect(off.errorCode).toBe(3100);

    // toggle 关闭 → 全新 disabled 态（消息清空）
    const toggled = reduceAi(streaming, { type: "toggle-enabled" });
    expect(toggled.enabled).toBe(false);
    expect(toggled.msgs).toEqual([]);
    expect(reduceAi(toggled, { type: "toggle-enabled" }).enabled).toBe(true);
  });

  it("未知/无效帧不破坏状态；reset 回 idle 保留开关", () => {
    const s = feed([{ type: "send", text: "x" }, { type: "frame", frame: { event: "ping", data: "{}" } }]);
    expect(s.msgs[1].content).toBe(""), "非 message 帧不追加";
    const r = reduceAi(s, { type: "reset" });
    expect(r.status).toBe("idle");
    expect(r.enabled).toBe(true);
    expect(r.msgs).toEqual([]);
  });

  it("extractDelta：普通串/转义/非 delta JSON", () => {
    expect(extractDelta('{"delta":"解方程"}')).toBe("解方程");
    expect(extractDelta('{"delta":"换行\\n符"}')).toBe("换行\n符");
    expect(extractDelta('{"delta":"引\\"号"}')).toBe('引"号');
    expect(extractDelta('{"other":1}')).toBe("");
    expect(extractDelta("纯文本")).toBe("纯文本");
  });
});

describe("模式与配额（E5 / PointsRules 镜像）", () => {
  it("默认苏格拉底；direct 指令文案", () => {
    expect(resolveMode(null)).toBe("SOCRATIC");
    expect(resolveMode(undefined)).toBe("SOCRATIC");
    expect(resolveMode("DIRECT")).toBe("DIRECT");
    expect(modeDirective("SOCRATIC")).toContain("不给答案");
    expect(modeDirective("DIRECT")).toContain("完整解答");
  });

  it("对话成本前 3 免费；限制文案", () => {
    expect(chatCostFront(0)).toBe(0);
    expect(chatCostFront(2)).toBe(0);
    expect(chatCostFront(3)).toBe(5);
    expect(LIMITED_TEXT).toContain("3101");
    expect(DISABLED_TEXT).toContain("3100");
  });

  it("上下文标签与快捷追问", () => {
    expect(contextLabel(null)).toContain("全局");
    expect(contextLabel({ type: "question", id: 1024 })).toContain("题目 #1024");
    expect(contextLabel({ type: "formula", id: 7, title: "勾股定理" })).toContain("公式 #7 · 勾股定理");
    expect(quickAsks()).toHaveLength(2);
    expect(quickAsks()[0]).toContain("同除");
  });
});

describe("全屏搜索分组（W18）", () => {
  const corpus: SearchDoc[] = [
    { type: "node", id: 12, name: "因式分解", sub: "代数" },
    { type: "formula", id: 7, name: "勾股定理", sub: "毕达哥拉斯定理" },
    { type: "question", id: 1024, name: "x²−5x+6=0 分解", sub: "因式分解基础" },
    { type: "course", id: 1, name: "一元二次方程", sub: "因式分解入门" },
    { type: "post", id: 88, name: "这步为什么除 sinC", sub: "三角学" },
    { type: "question", id: 1087, name: "双直角勾股逆用", sub: "勾股" },
    { type: "node", id: 13, name: "判别式", sub: "Δ=b²−4ac" },
  ];

  it("关键词跨组匹配：trim+小写+组序+每组截断与 total", () => {
    const groups = searchGroups(corpus, " 因式 ");
    expect(groups.map((g) => g.key)).toEqual(["node", "question", "course"]);
    expect(groups[1].total).toBe(1);
    expect(searchGroups(corpus, "勾股").map((g) => g.key)).toEqual(["formula", "question"]);
    const big = searchGroups(
      Array.from({ length: 7 }, (_, i) => ({ type: "question" as const, id: i, name: "因式题" })),
      "因式",
      3,
    );
    expect(big[0].items).toHaveLength(3);
    expect(big[0].total).toBe(7), "截 3 展示 total 全量";
  });

  it("空查询/无结果态与推荐词", () => {
    expect(searchGroups(corpus, "")).toEqual([]);
    expect(searchGroups(corpus, "   ")).toEqual([]);
    expect(searchEmptyState(false)).toContain("正弦起源");
    expect(searchEmptyState(true)).toContain("无结果");
    expect(SEARCH_SUGGESTIONS).toContain("判别式");
    expect(searchGroups(corpus, "不存在")).toEqual([]);
  });

  it("类型路径映射与兜底", () => {
    expect(searchPath({ type: "course", id: 1 })).toBe("/paths/course/1");
    expect(searchPath({ type: "question", id: 9 })).toBe("/deepdive/question/9");
    expect(searchPath({ type: "node", id: 12 })).toBe("/graph/node/12");
    expect(searchPath({ type: "formula", id: 7 })).toBe("/formulas/7");
    expect(searchPath({ type: "post", id: 88 })).toBe("/community/post/88");
    expect(searchPath({ type: "other" as never, id: 1 })).toBe("/");
  });
});
