/**
 * 函数画板只接受数学表达式语法，不执行输入的 JavaScript。
 * 支持 x、pi、e、数字、括号、+ - * / ^ 和单参函数。
 */
export class PlotExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlotExpressionError";
  }
}

type Token = { type: "number" | "name" | "symbol" | "end"; text: string; value?: number };
type Node =
  | { type: "number"; value: number }
  | { type: "variable" }
  | { type: "unary"; op: "+" | "-"; child: Node }
  | { type: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: Node; right: Node }
  | { type: "function"; name: keyof typeof functions; child: Node };

const functions = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  sqrt: Math.sqrt, exp: Math.exp, log: Math.log10,
  ln: Math.log, abs: Math.abs
};

function tokenize(input: string): Token[] {
  if (!input.trim()) throw new PlotExpressionError("请输入 y = 后面的表达式。");
  if (input.length > 120) throw new PlotExpressionError("表达式太长，请控制在 120 个字符以内。");
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const rest = input.slice(index);
    if (/^\s/.test(rest)) { index++; continue; }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(rest);
    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value) || Math.abs(value) > 1e9) throw new PlotExpressionError("数字超出画板范围。");
      tokens.push({ type: "number", text: number[0], value });
      index += number[0].length;
    } else {
      const name = /^[A-Za-z]+/.exec(rest);
      if (name) {
        const text = name[0].toLowerCase();
        if (!(text === "x" || text === "pi" || text === "e" || Object.prototype.hasOwnProperty.call(functions, text))) {
          throw new PlotExpressionError("只支持 x、pi、e 与指定数学函数。");
        }
        tokens.push({ type: "name", text });
        index += name[0].length;
      } else if ("+-*/^()".includes(rest[0] || "\0")) {
        tokens.push({ type: "symbol", text: rest[0] });
        index++;
      } else {
        throw new PlotExpressionError("表达式包含不支持的字符。");
      }
    }
    if (tokens.length > 100) throw new PlotExpressionError("表达式太复杂，请简化后重试。");
  }
  tokens.push({ type: "end", text: "" });
  return tokens;
}

export function parsePlotExpression(input: string): (x: number) => number | null {
  const tokens = tokenize(input);
  let position = 0;
  const peek = () => tokens[position]!;
  const take = () => tokens[position++]!;
  const fail = (): never => { throw new PlotExpressionError("请检查括号、函数和运算符是否完整。"); };
  const checkDepth = (depth: number) => {
    if (depth > 32) throw new PlotExpressionError("括号或运算嵌套太深。");
  };

  function primary(depth: number): Node {
    checkDepth(depth);
    const token = take();
    if (token.type === "number") return { type: "number", value: token.value! };
    if (token.text === "(") {
      const node = add(depth + 1);
      if (take().text !== ")") return fail();
      return node;
    }
    if (token.type === "name") {
      if (token.text === "x") return { type: "variable" };
      if (token.text === "pi" || token.text === "e") return { type: "number", value: token.text === "pi" ? Math.PI : Math.E };
      if (Object.prototype.hasOwnProperty.call(functions, token.text)) {
        if (take().text !== "(") return fail();
        const node = add(depth + 1);
        if (take().text !== ")") return fail();
        return { type: "function", name: token.text as keyof typeof functions, child: node };
      }
    }
    return fail();
  }

  function power(depth: number): Node {
    checkDepth(depth);
    const left = primary(depth + 1);
    return peek().text === "^" ? (take(), { type: "binary", op: "^", left, right: unary(depth + 1) }) : left;
  }
  function unary(depth: number): Node {
    checkDepth(depth);
    if (peek().text === "+" || peek().text === "-") {
      const op = take().text as "+" | "-";
      return { type: "unary", op, child: unary(depth + 1) };
    }
    return power(depth + 1);
  }
  function multiply(depth: number): Node {
    checkDepth(depth);
    let node = unary(depth + 1);
    while (peek().text === "*" || peek().text === "/") {
      const op = take().text as "*" | "/";
      node = { type: "binary", op, left: node, right: unary(depth + 1) };
    }
    return node;
  }
  function add(depth: number): Node {
    checkDepth(depth);
    let node = multiply(depth + 1);
    while (peek().text === "+" || peek().text === "-") {
      const op = take().text as "+" | "-";
      node = { type: "binary", op, left: node, right: multiply(depth + 1) };
    }
    return node;
  }

  const tree = add(0);
  if (peek().type !== "end") fail();

  function evaluate(node: Node, x: number): number {
    switch (node.type) {
      case "number": return node.value;
      case "variable": return x;
      case "unary": return node.op === "-" ? -evaluate(node.child, x) : evaluate(node.child, x);
      case "function": return functions[node.name](evaluate(node.child, x));
      case "binary": {
        const left = evaluate(node.left, x);
        const right = evaluate(node.right, x);
        switch (node.op) {
          case "+": return left + right;
          case "-": return left - right;
          case "*": return left * right;
          case "/": return right === 0 ? NaN : left / right;
          case "^": return Math.pow(left, right);
        }
      }
    }
  }

  return (x: number) => {
    if (!Number.isFinite(x)) return null;
    const value = evaluate(tree, x);
    return Number.isFinite(value) ? value : null;
  };
}
