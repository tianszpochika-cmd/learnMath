import { describe, expect, it } from "vitest";
import { parsePlotExpression, PlotExpressionError } from "../utils/plotExpression";

describe("安全函数表达式", () => {
  it("支持基本运算、函数和右结合幂", () => {
    expect(parsePlotExpression("x^2 + 2*x + 1")(3)).toBe(16);
    expect(parsePlotExpression("sin(pi/2)")(0)).toBeCloseTo(1);
    expect(parsePlotExpression("2^3^2")(0)).toBe(512);
    expect(parsePlotExpression("-x^2")(3)).toBe(-9);
  });

  it("定义域和除零返回断线，不伪造数值", () => {
    expect(parsePlotExpression("1/x")(0)).toBeNull();
    expect(parsePlotExpression("sqrt(x)")(-1)).toBeNull();
    expect(parsePlotExpression("log(x)")(0)).toBeNull();
  });

  it.each(["x;alert(1)", "constructor", "constructor(x)", "toString(x)", "window.location", "sin.constructor(x)", "x/**/2", "x=1", "2x", "Math.sin(x)"])(
    "拒绝非白名单输入 %s",
    (input) => expect(() => parsePlotExpression(input)).toThrow(PlotExpressionError)
  );

  it("拒绝过长或不完整的表达式", () => {
    expect(() => parsePlotExpression("x".repeat(121))).toThrow(PlotExpressionError);
    expect(() => parsePlotExpression("sin(")).toThrow(PlotExpressionError);
    expect(() => parsePlotExpression("1+")).toThrow(PlotExpressionError);
  });
});
