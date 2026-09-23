import { describe, expect, it } from "vitest";
import { publicSearchResults } from "./searchResults";

describe("公开聚合搜索投影", () => {
  it("识别嵌套分组和仅有 ID 的公式，并拒绝危险链接", () => {
    expect(publicSearchResults({ groups: {
      formulas: { items: [{ id: 42, name: "平方差" }] },
      glossary: [{ slug: "linear", title: "一次函数" }, { slug: "../admin", title: "错误" }]
    } })).toEqual([
      { title: "平方差", description: "", to: "/formulas/42", group: "公式" },
      { title: "一次函数", description: "", to: "/glossary/linear", group: "数学词条" }
    ]);
  });
});
