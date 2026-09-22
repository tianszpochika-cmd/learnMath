/**
 * 业务错误码（04 §3 单一事实源的前端镜像；新增必须同步 04 与 server ErrorCode）。
 */
export const ERROR_MESSAGES: Record<number, string> = {
  1001: "参数校验失败",
  1002: "验证码错误或过期",
  1004: "请求过于频繁",
  2001: "未登录",
  2003: "登录已过期，请重新登录",
  2004: "无权限",
  2007: "请先同意用户协议与隐私政策",
  2008: "账号注销冷静期，不可登录",
  2009: "账号已注销",
  3007: "存在进行中的作答",
  3011: "计划已被修改，请查看差异后确认",
  3012: "内容版本冲突，请刷新后重试",
  3100: "AI 未启用",
  3101: "AI 次数或积分不足",
  3102: "AI 服务暂时不可用",
  3200: "该功能未配置",
  3310: "图谱成环",
  3311: "前置条件未满足",
  3312: "晋级条件未达",
  3401: "内容命中审核，暂不可见",
  3402: "内容已删除",
  3403: "请勿重复点赞",
  3501: "今日已打卡",
  3502: "补签卡不足",
  3503: "积分余额不足",
  5000: "内部错误",
  5003: "触发限流",
  5004: "服务暂不可用",
};

/** 业务异常（code!==0 时由 api-client 抛出）。 */
export class ApiError extends Error {
  readonly code: number;

  constructor(code: number, message?: string) {
    super(message || ERROR_MESSAGES[code] || `业务错误 ${code}`);
    this.name = "ApiError";
    this.code = code;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function messageForCode(code: number): string {
  return ERROR_MESSAGES[code] || `业务错误 ${code}`;
}
