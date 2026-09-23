import { afterEach, describe, expect, it, vi } from "vitest";
import { chatMessages, streamMobileChat } from "./mobileAi";
import { clearMobileSession, setMobileSession } from "./mobileClient";

afterEach(() => { clearMobileSession(); vi.unstubAllGlobals(); });
describe("mobile AI platform fallback", () => {
  it("maps persisted numeric roles without inventing missing messages", () => {
    expect(chatMessages({ messages: [{ role: 1, content: "问题" }, { role: 2, content: "解答" }, { role: 3, content: "隐藏" }] }))
      .toEqual([{ role: "user", content: "问题" }, { role: "assistant", content: "解答" }]);
    expect(chatMessages({})).toBeNull();
  });
  it("reads the complete authenticated SSE body on non-browser platforms", async () => {
    const seen: string[] = [];
    const request = vi.fn((options: { header: Record<string, string>; success: (value: {statusCode:number;data:string}) => void }) => {
      expect(options.header.authorization).toBe("Bearer access");
      options.success({ statusCode: 200, data: 'event: meta\ndata: {"conversationId":7}\n\nevent: delta\ndata: {"text":"推导"}\n\nevent: done\ndata: {}\n\n' });
      return { abort: vi.fn() };
    });
    vi.stubGlobal("uni", { request, setStorageSync: vi.fn(), removeStorageSync: vi.fn() });
    setMobileSession({ accessToken: "access", refreshToken: "refresh", userId: "u1" });
    await streamMobileChat({ question: "为什么" }, { meta: (id) => seen.push(id), delta: (text) => seen.push(text) }, new AbortController().signal);
    expect(seen).toEqual(["7", "推导"]);
  });
  it("does not present an incomplete response as a finished answer", async () => {
    vi.stubGlobal("uni", { request: (options: { success: (value: {statusCode:number;data:string}) => void }) => {
      options.success({ statusCode: 200, data: 'event: delta\ndata: {"text":"一半"}\n\n' }); return { abort: vi.fn() };
    }, setStorageSync: vi.fn(), removeStorageSync: vi.fn() });
    setMobileSession({ accessToken: "access", refreshToken: "refresh", userId: "u1" });
    await expect(streamMobileChat({ question: "问题" }, { meta: vi.fn(), delta: vi.fn() }, new AbortController().signal)).rejects.toThrow("没有完成标记");
  });
});
