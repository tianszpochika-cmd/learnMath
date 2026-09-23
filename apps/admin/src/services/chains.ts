import type { HttpClient } from "@learnmath/api-client";
import { getAdminHttp } from "./client";

export type ChainSubject = "question" | "formula";
const id = (value: number): number => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("资源编号无效");
  return value;
};
const subject = (value: string): ChainSubject => {
  if (value !== "question" && value !== "formula") throw new Error("只支持题目或公式推理链");
  return value;
};

export function createChainsApi(client: HttpClient = getAdminHttp()) {
  const base = "/api/admin/v1";
  const chain = (type: string, subjectId: number) => `${base}/deepdive/${subject(type)}/${id(subjectId)}/chain`;
  return {
    read: (type: string, subjectId: number) => client.request<unknown>({ method: "GET", path: chain(type, subjectId) }),
    save: (type: string, subjectId: number, body: unknown) => client.request<unknown>({ method: "PUT", path: chain(type, subjectId), body }),
    preview: (pathId: number) => client.request<unknown>({ method: "GET", path: `${base}/content/chain/${id(pathId)}/preview` }),
    publish: (pathId: number, expectedRevision: number) => {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error("工作稿版本无效");
      return client.request<unknown>({ method: "POST", path: `${base}/content/chain/${id(pathId)}/publish`, body: { expectedRevision } });
    },
  };
}
