import type { SseEvent } from "./types.js";

/**
 * SSE 流解析器（04 §2.4：event: message|done|error + data: {...}，流终结 data:[DONE]）。
 * 纯字符串处理 —— 分块喂入（chunk 可在任意字节处切开），空行分发一帧。
 * 兼容 CRLF/LF；跳过 ':' 注释行；多行 data 以 \n 拼接；无 event 字段默认 "message"。
 */
export const DONE_SENTINEL = "[DONE]";

export function parseSseBlock(block: string): SseEvent | null {
  let event = "";
  const dataLines: string[] = [];
  let sawField = false;
  for (const rawLine of block.split(/\r?\n/)) {
    if (rawLine === "" || rawLine.startsWith(":")) {
      continue;
    }
    const idx = rawLine.indexOf(":");
    const field = idx === -1 ? rawLine : rawLine.slice(0, idx);
    let value = idx === -1 ? "" : rawLine.slice(idx + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }
    sawField = true;
    if (field === "event") {
      event = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
    // 其余字段（id/retry）忽略 —— 业务只消费 event+data
  }
  if (!sawField) {
    return null;
  }
  return {
    event: event || "message",
    data: dataLines.join("\n"),
  };
}

export interface SseParser {
  /** 喂入一块文本，返回本次**完整**帧（可能 0..n 帧）；残缺部分留在缓冲。 */
  push(chunk: string): SseEvent[];
  /** 缓冲中未完成的文本（测试用）。 */
  pending(): string;
  /** 是否已收到 [DONE]。 */
  done(): boolean;
}

export function createSseParser(): SseParser {
  let buffer = "";
  let doneFlag = false;

  return {
    push(chunk: string): SseEvent[] {
      buffer += chunk;
      const out: SseEvent[] = [];
      // 以"空行"为帧边界（\n\n 或 \r\n\r\n）
      for (;;) {
        const re = /\r?\n\r?\n/;
        const m = re.exec(buffer);
        if (!m) {
          break;
        }
        const block = buffer.slice(0, m.index);
        buffer = buffer.slice(m.index + m[0].length);
        const evt = parseSseBlock(block);
        if (evt) {
          if (evt.data === DONE_SENTINEL) {
            doneFlag = true;
          }
          out.push(evt);
        }
      }
      return out;
    },
    pending(): string {
      return buffer;
    },
    done(): boolean {
      return doneFlag;
    },
  };
}

/** 便捷判断流是否终结。 */
export function isDoneEvent(evt: SseEvent): boolean {
  return evt.data === DONE_SENTINEL;
}
