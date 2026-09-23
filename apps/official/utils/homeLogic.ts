export type PathSlug = "course" | "graph" | "plan" | "ladder" | "special" | "challenge";

export interface QuizAnswer {
  course: number;
  graph: number;
  plan: number;
  ladder: number;
  special: number;
  challenge: number;
}

export const quizQuestions: Array<{ prompt: string; options: Array<{ label: string; weights: QuizAnswer }> }> = [
  {
    prompt: "碰到一道不会的题，你最想先做什么？",
    options: [
      { label: "回到概念与例题，按顺序再读一遍", weights: { course: 3, graph: 0, plan: 0, ladder: 1, special: 0, challenge: 0 } },
      { label: "找出缺了哪个前置知识点", weights: { course: 0, graph: 3, plan: 0, ladder: 0, special: 1, challenge: 0 } },
      { label: "先做一题同类题，看看自己能到哪一步", weights: { course: 0, graph: 0, plan: 0, ladder: 2, special: 0, challenge: 2 } }
    ]
  },
  {
    prompt: "如果只有 20 分钟，你更愿意怎样用？",
    options: [
      { label: "稳稳学完一个课时", weights: { course: 3, graph: 0, plan: 1, ladder: 0, special: 0, challenge: 0 } },
      { label: "围绕一个有趣主题，追问它从哪里来", weights: { course: 0, graph: 1, plan: 0, ladder: 0, special: 3, challenge: 0 } },
      { label: "完成一个明确的阶段目标", weights: { course: 0, graph: 0, plan: 1, ladder: 1, special: 0, challenge: 3 } }
    ]
  },
  {
    prompt: "什么样的学习反馈最能帮到你？",
    options: [
      { label: "知道今天安排了什么，以及下一步怎么调整", weights: { course: 0, graph: 0, plan: 4, ladder: 0, special: 0, challenge: 0 } },
      { label: "看见知识点之间的连接与薄弱处", weights: { course: 0, graph: 3, plan: 0, ladder: 0, special: 1, challenge: 0 } },
      { label: "看见自己在同一类题里逐级进步", weights: { course: 0, graph: 0, plan: 0, ladder: 4, special: 0, challenge: 1 } }
    ]
  }
];

const order: PathSlug[] = ["course", "graph", "plan", "ladder", "special", "challenge"];

export function recommendPath(selections: readonly number[]): PathSlug | null {
  if (selections.length !== quizQuestions.length ||
    selections.some((answer, index) => !Number.isInteger(answer) || answer < 0 || answer >= quizQuestions[index].options.length)) return null;
  const scores = Object.fromEntries(order.map((slug) => [slug, 0])) as Record<PathSlug, number>;
  selections.forEach((answer, index) => {
    const weights = quizQuestions[index].options[answer].weights;
    for (const slug of order) scores[slug] += weights[slug];
  });
  return order.reduce((best, slug) => scores[slug] > scores[best] ? slug : best, order[0]);
}

export function countdownLabel(nextAt: string | null | undefined, nowMs: number): string | null {
  if (!nextAt) return null;
  const end = Date.parse(nextAt);
  if (!Number.isFinite(end)) return null;
  const seconds = Math.max(0, Math.ceil((end - nowMs) / 1000));
  const hours = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor(seconds % 3600 / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return hours + ":" + minutes + ":" + rest;
}

export interface PublicCard {
  slug: string;
  title: string;
  summary: string;
}

export function publicCards(value: unknown, limit = 3, useId = false): PublicCard[] {
  const raw = Array.isArray(value) ? value : value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)
    ? (value as { items: unknown[] }).items : [];
  return raw.flatMap((item): PublicCard[] => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const slug = String(useId ? entry.id ?? entry.slug ?? "" : entry.slug ?? "");
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(slug)) return [];
    return [{ slug, title: String(entry.title || entry.name || "未命名"), summary: String(entry.summary || entry.originSummary || "") }];
  }).slice(0, limit);
}
