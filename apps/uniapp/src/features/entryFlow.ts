export type SmsMode = "login" | "register";
export interface PendingSms { phone: string; mode: SmsMode; consentVersion?: string; sentAt: number }
let pendingSms: PendingSms | null = null;
let assessmentInvite = false;
let resumeToken: string | null = null;

export function normalizePhone(value: string): string { return value.replace(/[\s-]/g, ""); }
export function validMainlandPhone(value: string): boolean { return /^1[3-9]\d{9}$/.test(normalizePhone(value)); }
export function validSmsCode(value: string): boolean { return /^\d{6}$/.test(value.trim()); }
export function setPendingSms(value: PendingSms): void { pendingSms = value; }
export function getPendingSms(): PendingSms | null { return pendingSms; }
export function clearPendingSms(): void { pendingSms = null; }
export function cooldownSeconds(sentAt: number, now: number): number { return Math.max(0, Math.ceil((sentAt + 60_000 - now) / 1000)); }
export function queueAssessmentInvite(): void { assessmentInvite = true; }
export function takeAssessmentInvite(): boolean { const value = assessmentInvite; assessmentInvite = false; return value; }
export function setResumeToken(value: unknown): boolean {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,512}$/.test(value)) return false;
  resumeToken = value; return true;
}
export function getResumeToken(): string | null { return resumeToken; }
export function clearResumeToken(): void { resumeToken = null; }

export const TAB_PATHS = {
  home: "/pages/home/index", paths: "/pages/paths/index", practice: "/pages/practice/index",
  community: "/pages/community/index", me: "/pages/me/index",
} as const;
export type TabKey = keyof typeof TAB_PATHS;
export const TAB_ITEMS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "home", label: "首页", icon: "⌂" }, { key: "paths", label: "路径", icon: "◇" },
  { key: "practice", label: "做题", icon: "✎" }, { key: "community", label: "社区", icon: "◎" },
  { key: "me", label: "我的", icon: "◌" },
];
