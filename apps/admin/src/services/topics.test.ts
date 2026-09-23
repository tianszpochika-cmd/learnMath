import { beforeEach, describe, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("./client", () => ({ getAdminHttp: () => ({ request }) }));
import { moveTopicNode, projectTopic, projectTopics, readTopic, readTopics, saveTopic, topicDraftIssues } from "./topics";

beforeEach(() => request.mockReset());

describe("专题编排数据", () => {
  it("只使用服务端返回的节点身份和序列，不因调整顺序改 ID", () => {
    const topic = projectTopic({ id: 9, title: "代数", revision: 2, topicNodes: [
      { id: 31, type: "lesson", refId: 8, title: "先读" },
      { id: 32, type: "quiz", refId: 11, title: "再练" },
    ] });
    const moved = moveTopicNode(topic.nodes, 1, -1);
    expect(moved.map((node) => node.id)).toEqual(["32", "31"]);
    expect(topic.nodes.map((node) => node.id)).toEqual(["31", "32"]);
    expect(topicDraftIssues({ ...topic, nodes: moved })).toEqual([]);
    expect(projectTopics({ items: [{ id: 9, title: "代数", status: "draft" }] })).toEqual([{ id: "9", title: "代数", status: "draft" }]);
  });

  it("节点序列或引用缺失时阻止保存，不把空数组当真实专题", async () => {
    const missing = projectTopic({ id: 9, title: "代数" });
    expect(missing.nodesKnown).toBe(false);
    expect(topicDraftIssues(missing).join("；")).toContain("未返回专题节点序列");
    await expect(saveTopic(missing)).rejects.toThrow(/节点序列/);
    expect(request).not.toHaveBeenCalled();
    const malformed = projectTopic({ id: 9, title: "代数", nodes: [{ id: 1, type: "lesson", refId: 8 }, { type: "quiz", refId: 3 }] });
    expect(malformed.nodesKnown).toBe(false);
  });

  it("GET/PATCH 走管理域，保存只提交名称、节点稳定 ID/引用/顺序与已知 revision", async () => {
    const detail = { id: "9", title: "代数", status: "draft", revision: 2, nodesKnown: true, nodes: [
      { id: "32", type: "quiz", refId: "11", title: "再练" },
      { id: "31", type: "lesson", refId: "8", title: "先读" },
    ] };
    request.mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({ id: 9, title: "代数", nodes: [] }).mockResolvedValueOnce({});
    await readTopics();
    await readTopic("9");
    await saveTopic(detail);
    expect(request.mock.calls.map(([arg]) => arg)).toEqual([
      { method: "GET", path: "/api/admin/v1/topics" },
      { method: "GET", path: "/api/admin/v1/topics/9" },
      { method: "PATCH", path: "/api/admin/v1/topics/9", body: {
        title: "代数", expectedRevision: 2,
        topicNodes: [{ id: "32", type: "quiz", refId: "11", sortOrder: 1 }, { id: "31", type: "lesson", refId: "8", sortOrder: 2 }],
      } },
    ]);
  });
});
