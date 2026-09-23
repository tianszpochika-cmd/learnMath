import type { HttpClient } from "../http.js";

/** 04 §4.1: only the SMS flow is wired in Web at present. */
export type SmsScene = "login" | "register";

export interface LoginSmsPayload {
  phone: string;
  smsCode: string;
  consentVersion?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  userId: string | null;
  needAssessment: boolean | null;
}

export interface LegalDocument {
  type: "terms" | "privacy";
  title: string;
  body: string;
  version: string | null;
}

export interface RedeemedIntent {
  resumeId: string;
  target: unknown;
  title: string | null;
}

export interface AuthApi {
  sendSmsCode(phone: string, scene?: SmsScene): Promise<void>;
  loginBySms(payload: LoginSmsPayload): Promise<LoginResult>;
  registerByPhone(payload: LoginSmsPayload): Promise<LoginResult>;
  getLegal(type: "terms" | "privacy"): Promise<LegalDocument | null>;
  refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }>;
  logout(): Promise<void>;
}

export interface NavigationIntentApi {
  redeem(resumeToken: string): Promise<RedeemedIntent>;
  read(resumeId: string): Promise<RedeemedIntent>;
  consume(resumeId: string): Promise<void>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function tokenPair(value: unknown): { accessToken: string; refreshToken: string } {
  const data = record(value);
  const accessToken = text(data.accessToken);
  const refreshToken = text(data.refreshToken);
  if (!accessToken || !refreshToken) throw new Error("认证服务未返回完整令牌");
  return { accessToken, refreshToken };
}

/** 04 §1 example returns user.id; some deployments return userId directly. */
export function normalizeLoginResult(value: unknown): LoginResult {
  const data = record(value);
  const tokens = tokenPair(data);
  const userId = text(data.userId) || text(record(data.user).id) || null;
  return {
    ...tokens,
    userId,
    needAssessment: typeof data.needAssessment === "boolean" ? data.needAssessment : null
  };
}

export function normalizeLegalDocument(type: "terms" | "privacy", value: unknown): LegalDocument | null {
  const response = record(value);
  const data = record(response.article ?? response.latest ?? response);
  const body = text(data.content) || text(data.body);
  if (!body) return null;
  return {
    type,
    title: text(data.title) || (type === "terms" ? "用户协议" : "隐私政策"),
    body,
    version: text(data.legalVersion) || text(data.legal_version) || null
  };
}

function normalizeRedeemed(value: unknown): RedeemedIntent {
  const data = record(value);
  const resumeId = text(data.resumeId);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(resumeId) || !data.target || typeof data.target !== "object") {
    throw new Error("恢复目标响应不完整");
  }
  return { resumeId, target: data.target, title: text(data.title) || null };
}

function validResumeId(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error("恢复目标编号无效");
  return value;
}

export function createAuthApi(client: HttpClient): AuthApi {
  return {
    sendSmsCode: async (phone, scene = "login") => {
      await client.request<void>({ method: "POST", path: "/api/app/v1/auth/sms/send", body: { phone, scene } });
    },
    loginBySms: async (payload) => normalizeLoginResult(await client.request<unknown>({
      method: "POST", path: "/api/app/v1/auth/login/sms", body: payload
    })),
    registerByPhone: async (payload) => normalizeLoginResult(await client.request<unknown>({
      method: "POST", path: "/api/app/v1/auth/register/phone", body: payload
    })),
    getLegal: async (type) => normalizeLegalDocument(type, await client.request<unknown>({
      method: "GET", path: "/api/app/v1/legal/" + type
    })),
    refresh: async (refreshToken) => tokenPair(await client.request<unknown>({
      method: "POST", path: "/api/app/v1/auth/refresh", body: { refreshToken }
    })),
    logout: async () => {
      await client.request<void>({ method: "POST", path: "/api/app/v1/auth/logout" });
    }
  };
}

export function createNavigationIntentApi(client: HttpClient): NavigationIntentApi {
  return {
    redeem: async (resumeToken) => normalizeRedeemed(await client.request<unknown>({
      method: "POST", path: "/api/app/v1/navigation/intents/redeem", body: { resumeToken }
    })),
    read: async (resumeId) => normalizeRedeemed(await client.request<unknown>({
      method: "GET", path: "/api/app/v1/navigation/intents/" + validResumeId(resumeId)
    })),
    consume: async (resumeId) => {
      await client.request<void>({
        method: "POST", path: "/api/app/v1/navigation/intents/" + validResumeId(resumeId) + "/consume"
      });
    }
  };
}
