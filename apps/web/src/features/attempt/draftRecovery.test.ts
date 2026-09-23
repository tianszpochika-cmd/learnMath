import { describe, expect, it } from "vitest";
import { draftKey, draftRecovery, parseLocalDraft } from "./draftRecovery";

describe("离线草稿恢复边界", () => {
  it("草稿按用户、作答和题号隔离", () => {
    expect(draftKey("u1", "a2", 3)).toBe("lm.draft:u1:a2:3");
    expect(draftKey(null, "a2", 3)).toBeNull();
    expect(draftKey("u1", "../admin", 3)).toBeNull();
  });

  it("同版本可恢复，跨版本要求并排确认，到期仅供复制", () => {
    const local = parseLocalDraft('{"value":"x=2","baseRevision":4,"updatedAt":100}');
    expect(draftRecovery("", 4, local, true)).toBe("restore");
    expect(draftRecovery("x=3", 5, local, true)).toBe("compare");
    expect(draftRecovery("", 5, local, false)).toBe("copy-only");
    expect(draftRecovery("x=2", 4, local, true)).toBe("none");
    expect(draftRecovery("x=2", 4, { value: "", baseRevision: 4, updatedAt: 101 }, true)).toBe("restore");
  });
});
