import { describe, expect, it } from "vitest";
import { projectPaths, projectPosts, projectTasks } from "./mobileData";
import { resolveMobileTarget } from "./mobileIntent";

describe("mobile server projection", () => {
  it("does not turn malformed response shapes into fabricated empty lists", () => {
    expect(projectTasks({})).toBeNull();
    expect(projectPaths({ items: [] })).toEqual([]);
    expect(projectPaths({ items: [{ code: "P7", name: "未知" }] })).toBeNull();
    expect(projectPosts({ items: [{ content: "缺编号" }] })).toBeNull();
  });
  it("reads only server supplied task and moderation state", () => {
    expect(projectTasks({ todayTasks: [{ id: 12, title: "阅读一课", status: 0 }] })?.[0]?.done).toBe(false);
    expect(projectPosts({ items: [{ id: 4, title: "讨论", status: 1 }] })?.[0]?.status).toBe("1");
  });
  it("maps cross-end target only to known internal pages", () => {
    expect(resolveMobileTarget({ targetType: "node", targetId: 18 })).toBe("/pages/learn/node/index?id=18");
    expect(resolveMobileTarget({ targetType: "question", targetId: 42 })).toContain("subjectId=42");
    expect(resolveMobileTarget({ targetType: "formula", targetId: 7 })).toBeNull();
    expect(resolveMobileTarget({ targetType: "node", targetId: "../other" })).toBeNull();
  });
});
