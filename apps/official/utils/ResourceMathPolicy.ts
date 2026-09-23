export interface MathRenderEngine {
  renderToString(source: string, options: {
    displayMode: boolean;
    output: "htmlAndMathml";
    throwOnError: true;
    strict: "error";
    trust: false;
    maxExpand: number;
    maxSize: number;
  }): string;
}

export interface ResourceMathResult {
  html: string | null;
  source: string;
}

/** 将不可信 LaTeX 限制在 KaTeX 严格模式；出错只返回可安全文本插值的原文。 */
export function renderWithMathEngine(source: string, displayMode: boolean, engine: MathRenderEngine): ResourceMathResult {
  const text = source.trim();
  if (!text || text.length > 2000) return { html: null, source: text };
  try {
    return {
      html: engine.renderToString(text, {
        displayMode,
        output: "htmlAndMathml",
        throwOnError: true,
        strict: "error",
        trust: false,
        maxExpand: 100,
        maxSize: 10
      }),
      source: text
    };
  } catch {
    return { html: null, source: text };
  }
}
