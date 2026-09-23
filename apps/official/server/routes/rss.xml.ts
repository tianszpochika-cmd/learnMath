import {
  SEO_ROUTE_AVAILABILITY,
  articleFeedEntries,
  buildRssXml,
  canonicalOrigin,
  collectPublicList,
  type PublicListFetcher
} from "../../utils/seo";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const origin = canonicalOrigin(config.public.siteUrl);
  if (!origin) throw createError({ statusCode: 503, statusMessage: "官网 canonical 地址尚未配置" });

  let articles: Awaited<ReturnType<typeof collectPublicList>> = [];
  if (SEO_ROUTE_AVAILABILITY.blog) {
    const apiBase = String(config.appApiBase).replace(/\/+$/, "");
    const fetchPage: PublicListFetcher = (kind, query) => $fetch(apiBase + "/" + kind, {
      query,
      timeout: 4000
    });
    articles = await collectPublicList("articles", fetchPage, { type: 1 });
  }
  setHeader(event, "content-type", "application/rss+xml; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=300, stale-while-revalidate=600");
  return buildRssXml(origin, articleFeedEntries(articles, SEO_ROUTE_AVAILABILITY.blog));
});
