import {
  SEO_ROUTE_AVAILABILITY,
  STATIC_SITE_PATHS,
  articleTaxonomyEntries,
  buildSitemapXml,
  canonicalOrigin,
  collectPublicList,
  contentSitemapEntries,
  type PublicListFetcher,
  type PublicListKind
} from "../../utils/seo";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const origin = canonicalOrigin(config.public.siteUrl);
  if (!origin) throw createError({ statusCode: 503, statusMessage: "官网 canonical 地址尚未配置" });

  const apiBase = String(config.appApiBase).replace(/\/+$/, "");
  const fetchPage: PublicListFetcher = (kind, query) => $fetch(apiBase + "/" + kind, {
    query,
    timeout: 4000
  });
  const kinds: PublicListKind[] = ["glossary", "formulas", "articles"];
  const dynamic = await Promise.all(kinds.map(async (kind) => {
    const routeAvailable = kind === "articles"
      ? SEO_ROUTE_AVAILABILITY.blog || SEO_ROUTE_AVAILABILITY.cases ||
        SEO_ROUTE_AVAILABILITY.help || SEO_ROUTE_AVAILABILITY.events || SEO_ROUTE_AVAILABILITY.legal
      : SEO_ROUTE_AVAILABILITY[kind];
    if (!routeAvailable) return [];
    const items = await collectPublicList(kind, fetchPage);
    const entries = contentSitemapEntries(kind, items, true).filter((entry) => {
      if (entry.path.startsWith("/blog/")) return SEO_ROUTE_AVAILABILITY.blog;
      if (entry.path.startsWith("/cases/")) return SEO_ROUTE_AVAILABILITY.cases;
      if (entry.path.startsWith("/help/")) return SEO_ROUTE_AVAILABILITY.help;
      if (entry.path.startsWith("/events/")) return SEO_ROUTE_AVAILABILITY.events;
      if (entry.path.startsWith("/legal/")) return SEO_ROUTE_AVAILABILITY.legal;
      return true;
    });
    return kind === "articles"
      ? [...entries, ...articleTaxonomyEntries(items, SEO_ROUTE_AVAILABILITY.blogTaxonomy)]
      : entries;
  }));
  const entries = [
    ...STATIC_SITE_PATHS.map((path) => ({ path })),
    ...dynamic.flat()
  ];
  setHeader(event, "content-type", "application/xml; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=300, stale-while-revalidate=600");
  return buildSitemapXml(origin, entries);
});
