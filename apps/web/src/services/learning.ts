import { getAppHttp } from "./client";

/** 04 §4.2/4.3/4.6/4.8：只调用已登记的学习端接口。GET 的完整 DTO 尚未冻结，先保留 unknown。 */
export const learningApi = {
  home: () => getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/user/home" }),
  paths: () => getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/paths" }),
  courses: () => getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/courses" }),
  course: (id: string) => getAppHttp().request<unknown>({ method: "GET", path: `/api/app/v1/courses/${safeId(id)}` }),
  courseTree: (id: string) => getAppHttp().request<unknown>({ method: "GET", path: `/api/app/v1/courses/${safeId(id)}/tree` }),
  lesson: (id: string) => getAppHttp().request<unknown>({ method: "GET", path: `/api/app/v1/lessons/${safeId(id)}` }),
  heartbeat: (id: string, second: number) => getAppHttp().request<unknown>({ method: "POST", path: `/api/app/v1/lessons/${safeId(id)}/heartbeat`, body: { second } }),
  readLesson: (id: string) => getAppHttp().request<unknown>({ method: "POST", path: `/api/app/v1/lessons/${safeId(id)}/read` }),
  completeLesson: (id: string) => getAppHttp().request<unknown>({ method: "POST", path: `/api/app/v1/lessons/${safeId(id)}/complete` }),
  checkin: () => getAppHttp().request<unknown>({ method: "POST", path: "/api/app/v1/checkin" }),
};

export function safeId(value: string): string {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error("无效的学习资源编号");
  }
  return value;
}

export function learningError(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "暂时无法获取学习数据，请稍后重试。";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
