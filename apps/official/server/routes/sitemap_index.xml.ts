import { buildSitemapIndexXml, canonicalOrigin } from "../../utils/seo";

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  const origin = canonicalOrigin(config.public.siteUrl);
  if (!origin) throw createError({ statusCode: 503, statusMessage: "官网 canonical 地址尚未配置" });
  setHeader(event, "content-type", "application/xml; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=3600");
  return buildSitemapIndexXml(origin);
});
