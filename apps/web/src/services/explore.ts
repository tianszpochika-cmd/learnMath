import { getAppHttp } from "./client";

type DeepQueryMode = "read" | "predict" | "compare";

function resourceId(value: string | number): string {
  const text = String(value);
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) throw new Error("无效的资源编号");
  return text;
}

function subjectType(value: string): "question" | "formula" {
  if (value !== "question" && value !== "formula") throw new Error("不支持的深钻资源类型");
  return value;
}

export const exploreApi = {
  deepdive: (type: string, id: string, mode: DeepQueryMode) =>
    getAppHttp().request<unknown>({ method: "GET", path: `/api/app/v1/deepdive/${subjectType(type)}/${resourceId(id)}`, query: { mode } }),
  predict: (type: string, id: string, body: {
    solutionPathId: number; chainVersion: number; stepId: number; answer: string; requestId: string;
  }) => getAppHttp().request<unknown>({ method: "POST", path: `/api/app/v1/deepdive/${subjectType(type)}/${resourceId(id)}/predict`, body }),
  reportBreak: (type: string, id: string, body: {
    solutionPathId: number; chainVersion: number; stepId: number;
  }) => getAppHttp().request<unknown>({ method: "POST", path: `/api/app/v1/deepdive/${subjectType(type)}/${resourceId(id)}/break`, body }),
  graph: () => getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/graph" }),
  node: (id: number) => getAppHttp().request<unknown>({ method: "GET", path: `/api/app/v1/graph/nodes/${resourceId(id)}` }),
  narrative: (id: number) => getAppHttp().request<unknown>({ method: "GET", path: `/api/app/v1/narratives/${resourceId(id)}` }),
  startPractice: (id: number) => getAppHttp().request<unknown>({
    method: "POST", path: "/api/app/v1/practice/quiz", body: { nodeIds: [Number(resourceId(id))], count: 1 },
  }),
};

export function exploreError(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "内容暂不可用，请稍后重试。";
}
