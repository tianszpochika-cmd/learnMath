import { ERROR_MESSAGES, messageForCode } from "./errors.js";

/** 中文文案表（同 ERROR_MESSAGES 单源再导出，预留多语言位）。 */
export const zhCN: Record<string, string> = {
  loading: "加载中…",
  empty: "暂无数据",
  retry: "重试",
  offline: "网络异常，显示本地草稿",
};

export function t(key: string, fallback?: string): string {
  return zhCN[key] || fallback || key;
}

export { messageForCode };
