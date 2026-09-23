import { describe, expect, it } from "vitest";
import { projectSearch } from "./search";

describe("服务端搜索结果投影", () => {
  it("只导航到已知类型与合法数字 ID，不在本地重新筛掉同义词命中", () => {
    const groups = projectSearch({ items: [
      { type: "node", id: 12, title: "一元二次方程" },
      { type: "post", id: 3, title: "换元法讨论" },
      { type: "admin", id: 5, title: "内部数据" },
      { type: "formula", id: "../secret", title: "无效地址" },
    ] });
    expect(groups.map((group) => group.key)).toEqual(["node", "post"]);
    expect(groups[0]?.items[0]?.name).toBe("一元二次方程");
  });
});
