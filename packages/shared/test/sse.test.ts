import { describe, expect, it } from "vitest";
import { DONE_SENTINEL, createSseParser, isDoneEvent, parseSseBlock } from "../src/sse.js";

describe("SSE 解析器（04 §2.4）", () => {
  it("完整单帧解析（event + data）", () => {
    const p = createSseParser();
    const evts = p.push('event: message\ndata: {"delta":"解"}\n\n');
    expect(evts).toHaveLength(1);
    expect(evts[0].event).toBe("message");
    expect(evts[0].data).toBe('{"delta":"解"}');
    expect(p.pending()).toBe("");
  });

  it("分块喂入：帧边界被切开也能重组", () => {
    const p = createSseParser();
    expect(p.push("event: mes")).toHaveLength(0);
    expect(p.push('sage\ndata: {"a":')).toHaveLength(0);
    expect(p.pending()).not.toBe("");
    const evts = p.push('1}\n\nevent: done\ndata: {}\n\n');
    expect(evts).toHaveLength(2);
    expect(evts[0]).toEqual({ event: "message", data: '{"a":1}' });
    expect(evts[1].event).toBe("done");
    expect(p.pending()).toBe("");
  });

  it("多行 data 拼接与空 event 默认 message", () => {
    const evt = parseSseBlock("data: 第一行\ndata: 第二行");
    expect(evt).toEqual({ event: "message", data: "第一行\n第二行" });
  });

  it("CRLF 帧边界与 ':' 注释行跳过、data 单空格剥离", () => {
    const p = createSseParser();
    const evts = p.push(": keepalive\r\n\r\nevent: error\r\ndata: {\"code\":3102}\r\n\r\n");
    expect(evts).toHaveLength(1);
    expect(evts[0].event).toBe("error");
    expect(evts[0].data).toBe('{"code":3102}');
  });

  it("data:[DONE] 终结标记", () => {
    const p = createSseParser();
    const evts = p.push(`event: done\ndata: {}\n\ndata:${DONE_SENTINEL}\n\n`);
    expect(evts).toHaveLength(2);
    expect(isDoneEvent(evts[1])).toBe(true);
    expect(p.done()).toBe(true);
    expect(createSseParser().done()).toBe(false);
  });

  it("空块/纯注释不产帧", () => {
    expect(parseSseBlock("")).toBeNull();
    expect(parseSseBlock(": only comment")).toBeNull();
    const p = createSseParser();
    expect(p.push("\n\n")).toHaveLength(0);
  });

  it("id/retry 字段被忽略但帧仍分发", () => {
    const evt = parseSseBlock("id: 42\nretry: 1000\ndata: x");
    expect(evt).toEqual({ event: "message", data: "x" });
  });
});
