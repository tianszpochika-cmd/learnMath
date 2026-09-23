import { describe, expect, it } from "vitest";
import { jsonLd } from "./jsonLd";

describe("JSON-LD script safety", () => {
  it("keeps published text from closing a script element", () => {
    const output = jsonLd({ name: "</script><img src=x> &" });
    expect(output).not.toContain("<");
    expect(JSON.parse(output).name).toBe("</script><img src=x> &");
  });
});
