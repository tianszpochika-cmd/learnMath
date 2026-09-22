import { resolveAfterLogin } from "../../router/guard";

/**
 * 登录纯策略（16W01 · 01 U-01/U-05 · 20 §9 BR-09；可单测，组件只做接线）。
 */

export interface ChannelConfig {
  sms: boolean;
  wechat: boolean;
  email: boolean;
  password: boolean;
}

export type ChannelId = "sms" | "wechat" | "email" | "password";

export const ALL_CHANNELS_ON: ChannelConfig = {
  sms: true,
  wechat: true,
  email: true,
  password: true,
};

/** 可用渠道按 M2 主次排序：验证码 → 微信 → 邮箱 → 账号密码；未配置自动隐藏（降级原则/3200）。 */
export function availableChannels(cfg: ChannelConfig): ChannelId[] {
  const out: ChannelId[] = [];
  if (cfg.sms) out.push("sms");
  if (cfg.wechat) out.push("wechat");
  if (cfg.email) out.push("email");
  if (cfg.password) out.push("password");
  return out;
}

/** 主渠道（"验证码为主"）；sms 未配 → password → wechat → email。 */
export function primaryChannel(cfg: ChannelConfig): ChannelId | null {
  if (cfg.sms) return "sms";
  if (cfg.password) return "password";
  if (cfg.wechat) return "wechat";
  return cfg.email ? "email" : null;
}

/** +86/空格/横杠归一，仅保留数字。 */
export function normalizePhone(raw: string): string {
  let s = (raw || "").replace(/^\+?86/, "");
  s = s.replace(/[\s\-()]/g, "");
  return s;
}

/** 大陆手机号（01 U-01 主渠道）。 */
export function isValidCnMobile(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(normalizePhone(phone));
}

export type SubmitBlock = "phone" | "consent" | "cooldown" | "no-channel";

export interface SmsSubmitState {
  phoneRaw: string;
  agreed: boolean;
  cooldownSec: number;
  channelEnabled: boolean;
}

export interface SubmitDecision {
  ok: boolean;
  block: SubmitBlock | null;
  message: string;
}

/** 获取验证码前置校验：渠道 → 协议(2007) → 手机号 → 频控(1004)。 */
export function smsSubmitDecision(s: SmsSubmitState): SubmitDecision {
  if (!s.channelEnabled) {
    return { ok: false, block: "no-channel", message: "该功能未配置（3200）" };
  }
  if (!s.agreed) {
    return { ok: false, block: "consent", message: "请先同意用户协议与隐私政策（2007）" };
  }
  if (!isValidCnMobile(s.phoneRaw)) {
    return { ok: false, block: "phone", message: "手机号格式不正确" };
  }
  if (s.cooldownSec > 0) {
    return { ok: false, block: "cooldown", message: `请 ${s.cooldownSec}s 后重试（1004）` };
  }
  return { ok: true, block: null, message: "" };
}

/** 协议版本比对（01 U-05：新版本 → 存量用户下次登录重新确认，2007）。 */
export function consentOutdated(providedVersion: string | null, currentVersion: string | null): boolean {
  if (!providedVersion || !currentVersion) {
    return true;
  }
  return providedVersion !== currentVersion;
}

/**
 * 登录成功落地（20 §9：**有目标先回资源**，测评仅非阻塞提示；开放重定向在此被
 * resolveAfterLogin 兜底拦截）。
 */
export function loginSuccessRoute(redirect: string | null | undefined): string {
  return resolveAfterLogin(redirect);
}

/** 测评提示形态：落地非首页（有目标）→ banner（非阻塞，可随时回目标）；落地=首页 → modal（S03）。 */
export function assessmentPromptPlacement(redirect: string | null | undefined): "banner" | "modal" {
  // 经 resolveAfterLogin 兜底后的有效落地为准（被拦的开放重定向 → "/" → modal）
  return loginSuccessRoute(redirect) === "/" ? "modal" : "banner";
}

/** 继续学习提示（BR-09 解析接口返回标题 → 注册页展示"完成后继续学习…"）。 */
export function continueLearningHint(displayTitle: string | null | undefined): string {
  return `完成后继续学习：${displayTitle && displayTitle.trim() ? displayTitle.trim() : "（目标）"}`;
}
