import { describe, expect, it, vi } from "vitest";
import { renderWithMathEngine, type MathRenderEngine } from "../utils/ResourceMathPolicy";

describe("官网数学排版策略", () => {
  it("只请求严格、无信任的 HTML 与 MathML 双输出", () => {
    const renderToString = vi.fn(() => "<span class=\"katex\">x</span>");
    const result = renderWithMathEngine("  x^2  ", true, { renderToString });
    expect(result.html).toContain("katex");
    expect(result.source).toBe("x^2");
    expect(renderToString).toHaveBeenCalledWith("x^2", {
      displayMode: true,
      output: "htmlAndMathml",
      throwOnError: true,
      strict: "error",
      trust: false,
      maxExpand: 100,
      maxSize: 10
    });
  });

  it("解析失败回退原文，永不把原始文本当 HTML", () => {
    const engine: MathRenderEngine = { renderToString: () => { throw new Error("bad latex"); } };
    const input = "\\href{javascript:alert(1)}{x}";
    expect(renderWithMathEngine(input, false, engine)).toEqual({ html: null, source: input });
  });

  it("空白与超长输入不会交给排版引擎", () => {
    const renderToString = vi.fn(() => "unused");
    const engine = { renderToString };
    expect(renderWithMathEngine(" ", false, engine).html).toBeNull();
    expect(renderWithMathEngine("x".repeat(2001), false, engine).html).toBeNull();
    expect(renderToString).not.toHaveBeenCalled();
  });
});
