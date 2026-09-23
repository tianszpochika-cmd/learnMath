import { describe, expect, it } from "vitest";
import { projectAccount, projectNotices } from "./me";

describe("个人与通知投影", () => {
  it("不把不存在的通知或账号冷静期补成演示值", () => {
    expect(projectNotices({})).toEqual([]);
    expect(projectAccount({})).toEqual({ nickname: "", status: "", deletionDueAt: "" });
  });

  it("只接受有安全 ID、标题和已知分类的通知", () => {
    expect(projectNotices({ items: [
      { id: 12, type: "LEARNING", title: "今日任务", read: false },
      { id: "../admin", type: "SYSTEM", title: "无效" },
      { id: 99, type: "UNKNOWN", title: "未知" },
    ] })).toEqual([{ id: "12", type: "LEARNING", title: "今日任务", createdAt: "", read: false }]);
  });
});
