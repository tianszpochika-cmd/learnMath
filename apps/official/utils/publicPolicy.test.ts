import { describe, expect, it } from "vitest";
import { allowedPublicPath, validIntent } from "./publicPolicy";

describe("官网公开接口边界", () => {
  it("只代理公开清单内的方法与路径", () => {
    expect(allowedPublicPath("GET", "/glossary/linear-equation")).toBe("glossary/linear-equation");
    expect(allowedPublicPath("POST", "newsletter/subscribe")).toBe("newsletter/subscribe");
    expect(allowedPublicPath("GET", "legal/privacy")).toBe("legal/privacy");
    expect(allowedPublicPath("GET", "legal/admin")).toBeNull();
    expect(allowedPublicPath("GET", "navigation/intents")).toBeNull();
    expect(allowedPublicPath("GET", "../admin/users")).toBeNull();
    expect(allowedPublicPath("GET", "glossary/a%2Fb")).toBeNull();
  });

  it("学习目标只接受本地白名单类型、动作与安全标识", () => {
    expect(validIntent({ targetType: "formula", slug: "quadratic", action: "read", from: "official/formulas/quadratic" })).toBe(true);
    expect(validIntent({ targetType: "user", slug: "quadratic", action: "read", from: "official/formulas/quadratic" })).toBe(false);
    expect(validIntent({ targetType: "formula", slug: "../admin", action: "read", from: "official/formulas" })).toBe(false);
    expect(validIntent({ targetType: "formula", slug: "quadratic", action: "read", from: "https://evil.example" })).toBe(false);
  });
});
