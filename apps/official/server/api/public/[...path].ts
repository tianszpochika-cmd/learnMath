import { allowedPublicPath, validIntent } from "../../../utils/publicPolicy";

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();
  const rawPath = getRouterParam(event, "path") || "";
  const path = allowedPublicPath(method, rawPath);
  if (!path) throw createError({ statusCode: 404, statusMessage: "该公开接口不存在" });

  const body = method === "POST" ? await readBody(event) : undefined;
  if (path === "navigation/intents" && !validIntent(body)) {
    throw createError({ statusCode: 400, statusMessage: "学习目标参数无效" });
  }
  if (path === "newsletter/subscribe" &&
    (!body || typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))) {
    throw createError({ statusCode: 400, statusMessage: "邮箱格式不正确" });
  }

  const config = useRuntimeConfig(event);
  const upstream = String(config.appApiBase).replace(/\/$/, "") + "/" + path;
  try {
    return await $fetch(upstream, {
      method: method as "GET" | "POST",
      query: method === "GET" ? getQuery(event) : undefined,
      body,
      timeout: 4000
    });
  } catch {
    throw createError({ statusCode: 503, statusMessage: "公开内容暂时不可用，请稍后重试" });
  }
});
