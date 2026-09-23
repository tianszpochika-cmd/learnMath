import { describe, expect, it } from "vitest";
import { activeAttemptRestricted } from "./activeRestriction";

describe("活动作答时收紧 AI 入口", () => {
  it("仅当前账号的服务端确认标记收紧，同一账号损坏标记也保守禁用", () => {
    const storage = { getItem: (key: string) => key.endsWith(":u1") ? '{"attemptId":"a1","restricted":true}' : null };
    expect(activeAttemptRestricted(storage, "u1")).toBe(true);
    expect(activeAttemptRestricted(storage, "u2")).toBe(false);
    expect(activeAttemptRestricted({ getItem: () => "{" }, "u1")).toBe(true);
    expect(activeAttemptRestricted(storage, null)).toBe(true);
  });
});
