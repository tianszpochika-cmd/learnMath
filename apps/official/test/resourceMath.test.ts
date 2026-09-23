import { describe, expect, it } from "vitest";
import { renderResourceMath } from "../utils/renderResourceMath";

describe("KaTeX 本地排版", () => {
  it("正常公式同时提供视觉 HTML 和辅助技术使用的 MathML", () => {
    const result = renderResourceMath("\\frac{a}{b}=x^2", true);
    expect(result.html).toContain('class="katex"');
    expect(result.html).toContain("<math");
  });

  it("不授予 LaTeX 创建链接或任意 HTML 的权限", () => {
    const result = renderResourceMath("\\href{javascript:alert(1)}{x}", false);
    expect(result.html || "").not.toMatch(/<a\b[^>]*href=/i);
    const styled = renderResourceMath("\\htmlStyle{position:fixed}{x}", false);
    expect(styled.html || "").not.toMatch(/style=["'][^"']*position:fixed/i);
  });

  it("解析异常保留原文且不生成 HTML", () => {
    const input = "\\frac{a}{";
    expect(renderResourceMath(input)).toEqual({ html: null, source: input });
  });
});
