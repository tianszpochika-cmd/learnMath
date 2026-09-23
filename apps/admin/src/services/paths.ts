import type { HttpClient } from "@learnmath/api-client";
import { getAdminHttp } from "./client";

const code = (value: string): string => {
  if (!/^P[1-6]$/.test(value)) throw new Error("路径编号必须是 P1–P6");
  return value;
};
const id = (value: number): number => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("节点编号无效");
  return value;
};
export interface PathNodeWrite {
  title: string;
  ref_type: number;
  ref_id: number;
  unlock_rule: Record<string, unknown>;
  seq: number;
  map_x?: number;
  map_y?: number;
}

export function createPathsApi(client: HttpClient = getAdminHttp()) {
  const base = "/api/admin/v1/paths";
  const path = (value: string) => `${base}/${code(value)}`;
  return {
    list: () => client.request<unknown>({ method: "GET", path: base }),
    nodes: (value: string) => client.request<unknown>({ method: "GET", path: `${path(value)}/nodes` }),
    createNode: (value: string, body: PathNodeWrite) => client.request<unknown>({ method: "POST", path: `${path(value)}/nodes`, body }),
    updateNode: (value: string, nodeId: number, body: Partial<PathNodeWrite>) => client.request<unknown>({ method: "PATCH", path: `${path(value)}/nodes/${id(nodeId)}`, body }),
    deleteNode: (value: string, nodeId: number) => client.request<unknown>({ method: "DELETE", path: `${path(value)}/nodes/${id(nodeId)}` }),
    validate: (value: string) => client.request<unknown>({ method: "POST", path: `${path(value)}/validate` }),
    coverage: () => client.request<unknown>({ method: "GET", path: "/api/admin/v1/content/coverage" }),
  };
}
