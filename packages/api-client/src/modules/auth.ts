import type { HttpClient } from "../http.js";

/**
 * 认证 API 模块（04 §4.1；模块化组织 —— 各域以同构薄封装收敛在 createXxxApi）。
 */
export interface LoginSmsPayload {
  phone: string;
  smsCode: string;
  consentVersion?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
  needAssessment: boolean;
}

export interface AuthApi {
  loginBySms(payload: LoginSmsPayload): Promise<LoginResult>;
  refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }>;
  logout(): Promise<void>;
}

export function createAuthApi(client: HttpClient): AuthApi {
  return {
    loginBySms: (payload) =>
      client.request<LoginResult>({
        method: "POST",
        path: "/api/app/v1/auth/login",
        body: payload,
      }),
    refresh: (refreshToken) =>
      client.request<{ accessToken: string; refreshToken: string }>({
        method: "POST",
        path: "/api/app/v1/auth/refresh",
        body: { refreshToken },
      }),
    logout: async () => {
      await client.request<void>({ method: "POST", path: "/api/app/v1/auth/logout" });
    },
  };
}
