import { describe, expect, it } from "vitest";
import { countdownLabel, publicCards, recommendPath } from "./homeLogic";

describe("官网首页纯逻辑", () => {
  it("三题测验只在答案完整且合法时产生推荐", () => {
    expect(recommendPath([0, 0, 0])).toBe("course");
    expect(recommendPath([1, 1, 1])).toBe("graph");
    expect(recommendPath([2, 2])).toBeNull();
    expect(recommendPath([0, 9, 1])).toBeNull();
  });
  it("公开内容卡只接受安全 slug，避免任意跳转", () => {
    expect(publicCards({ items: [{ slug: "pythagorean", name: "勾股定理" }, { slug: "../evil", title: "错误" }] })).toEqual([{ slug: "pythagorean", title: "勾股定理", summary: "" }]);
    expect(publicCards({ items: [{ id: 42, slug: "alias", name: "平方差公式" }] }, 3, true)).toEqual([{ slug: "42", title: "平方差公式", summary: "" }]);
  });
  it("倒计时来自明确的下一次发布时间", () => {
    expect(countdownLabel("2026-09-24T00:00:00Z", Date.parse("2026-09-23T23:59:00Z"))).toBe("00:01:00");
    expect(countdownLabel("bad", 0)).toBeNull();
    expect(countdownLabel("2026-09-23T00:00:00Z", Date.parse("2026-09-24T00:00:00Z"))).toBe("00:00:00");
  });
});
