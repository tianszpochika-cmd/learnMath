import { describe, expect, it } from "vitest";
import { clearPendingSms, cooldownSeconds, getPendingSms, normalizePhone, setPendingSms, setResumeToken, validMainlandPhone, validSmsCode } from "./entryFlow";

describe("mobile entry policy", () => {
  it("normalizes phone and accepts only six digit SMS codes", () => {
    expect(normalizePhone("138 0000-0000")).toBe("13800000000");
    expect(validMainlandPhone("138 0000 0000")).toBe(true);
    expect(validMainlandPhone("12800000000")).toBe(false);
    expect(validSmsCode("012345")).toBe(true);
    expect(validSmsCode("12345x")).toBe(false);
  });
  it("starts a resend cooldown only after a server-confirmed send", () => {
    clearPendingSms();
    expect(getPendingSms()).toBeNull();
    setPendingSms({ phone: "13800000000", mode: "login", sentAt: 1000 });
    expect(cooldownSeconds(getPendingSms()!.sentAt, 1000)).toBe(60);
    expect(cooldownSeconds(1000, 61_001)).toBe(0);
  });
  it("accepts only bounded opaque resume tokens", () => {
    expect(setResumeToken("safe_resume_token_12345")).toBe(true);
    expect(setResumeToken("https://example.com/target")).toBe(false);
    expect(setResumeToken("short")).toBe(false);
  });
});
