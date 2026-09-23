import katex from "katex";
import { renderWithMathEngine, type ResourceMathResult } from "./ResourceMathPolicy";

/**
 * 只把 KaTeX 生成的 HTML 交给视图层；任何解析失败都以 Vue 文本插值显示原文。
 * trust=false 禁止服务端公式创建链接、HTML、CSS 或外部资源。
 */
export function renderResourceMath(source: string, displayMode = false): ResourceMathResult {
  return renderWithMathEngine(source, displayMode, katex);
}
