import { features, paths } from "./siteContent";

/**
 * O-05: Only route templates that actually exist under pages/ belong here.
 * Add a route when its page is implemented, rather than advertising planned URLs.
 */
export const STATIC_SITE_PATHS = [
  "/",
  "/features",
  ...features.map((entry) => "/features/" + entry.slug),
  "/paths",
  ...paths.map((entry) => "/paths/" + entry.slug),
  "/glossary",
  "/formulas",
  "/blog",
  "/cases",
  "/help",
  "/events",
  "/daily",
  "/timeline",
  "/tools",
  "/changelog",
  "/community-preview",
  "/contact",
  "/download",
  "/faq",
  "/manifesto",
  "/media",
  "/pricing",
  "/roadmap"
] as const;

export const SEO_ROUTE_AVAILABILITY = {
  glossary: true,
  formulas: true,
  blog: true,
  cases: true,
  help: true,
  events: true,
  legal: true,
  blogTaxonomy: true
} as const;

export interface SitemapEntry {
  path: string;
  lastmod?: string;
}

export interface FeedEntry {
  slug: string;
  title: string;
  summary: string;
  publishedAt?: string;
}

export type PublicListKind = "glossary" | "formulas" | "articles";
export type PublicListFetcher = (
  kind: PublicListKind,
  query: { page: number; size: number; type?: number }
) => Promise<unknown>;

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : null;
}

function field(value: RecordValue, ...names: string[]): string {
  for (const name of names) {
    const item = value[name];
    if (typeof item === "string" && item.trim()) return item.trim();
    if (typeof item === "number" && Number.isFinite(item)) return String(item);
  }
  return "";
}

export function validSlug(value: unknown): value is string {
  // article.slug is VARCHAR(100); public resource routes accept ASCII slugs.
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/.test(value);
}

/** The configured canonical URL must be an origin, never the request Host header. */
export function canonicalOrigin(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash ||
      (url.pathname !== "/" && url.pathname !== "")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function canonicalUrl(origin: string, path: string): string {
  const normalized = canonicalOrigin(origin);
  if (!normalized || !path.startsWith("/") || path.startsWith("//") ||
    /[?#\\\u0000-\u001f]/.test(path)) {
    throw new Error("Invalid canonical URL");
  }
  return normalized + (path === "/" ? "/" : path.replace(/\/+$/, ""));
}

/** XML 1.0 text escaping, including removal of control characters and lone surrogates. */
export function escapeXml(value: unknown): string {
  let clean = "";
  for (const char of String(value ?? "")) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 9 || code === 10 || code === 13 ||
      (code >= 0x20 && code <= 0xD7FF) ||
      (code >= 0xE000 && code <= 0xFFFD) ||
      (code >= 0x10000 && code <= 0x10FFFF)) clean += char;
  }
  return clean
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Omit dates that cannot be substantiated by a publication timestamp. */
export function sitemapDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?:$|[T ])/.exec(value.trim());
  if (!match) return null;
  const parsed = new Date(match[1] + "T00:00:00Z");
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== match[1]
    ? null
    : match[1];
}

export function rssDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  // A timezone is required; a bare SQL DATETIME has no reliable UTC meaning.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toUTCString();
}

function published(recordValue: RecordValue, kind: PublicListKind): boolean {
  if (recordValue.published === false || recordValue.isPublished === false ||
    recordValue.unpublishedAt || recordValue.unpublished_at) return false;
  const status = field(recordValue, "status", "publishStatus", "reviewStatus").toLowerCase();
  if (!status) return true; // The public API is contractually publication-filtered.
  if (kind === "articles") return ["2", "published", "active", "online"].includes(status);
  if (kind === "formulas") return ["1", "published", "active", "online"].includes(status);
  // A glossary projection may expose the node (1=online) or narrative (3=published) status.
  return ["1", "3", "published", "active", "online"].includes(status);
}

interface ListPage {
  items: unknown[];
  total: number | null;
}

function parsePage(response: unknown): ListPage | null {
  const envelope = record(response);
  if (!envelope || envelope.code !== 0) return null;
  const data = envelope.data;
  if (Array.isArray(data)) return { items: data, total: data.length };
  const page = record(data);
  if (!page || !Array.isArray(page.items)) return null;
  const total = typeof page.total === "number" && Number.isSafeInteger(page.total) && page.total >= 0
    ? page.total
    : null;
  return { items: page.items, total };
}

/**
 * Fail closed on an unavailable or incomplete source. A partial paginated list
 * must never be presented as a complete sitemap/feed.
 */
export async function collectPublicList(
  kind: PublicListKind,
  fetchPage: PublicListFetcher,
  options: { size?: number; maxPages?: number; type?: number } = {}
): Promise<RecordValue[]> {
  const size = Math.max(1, Math.min(100, options.size ?? 100));
  const maxPages = Math.max(1, Math.min(100, options.maxPages ?? 100));
  const collected: RecordValue[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    let payload: ListPage | null;
    try {
      payload = parsePage(await fetchPage(kind, { page, size, type: options.type }));
    } catch {
      return [];
    }
    if (!payload) return [];
    collected.push(...payload.items.flatMap((item) => {
      const entry = record(item);
      return entry && published(entry, kind) ? [entry] : [];
    }));
    if (payload.total !== null && page * size >= payload.total) return collected;
    if (payload.items.length < size) return collected;
  }
  return []; // The configured cap was reached without proof that all pages were read.
}

export function contentSitemapEntries(
  kind: PublicListKind,
  items: readonly RecordValue[],
  routeAvailable: boolean
): SitemapEntry[] {
  if (!routeAvailable) return [];
  const prefix = kind === "glossary" ? "/glossary/" : "/formulas/";
  return items.flatMap((item): SitemapEntry[] => {
    const slug = kind === "formulas" ? field(item, "id", "slug") : field(item, "slug");
    if (!validSlug(slug) || !published(item, kind)) return [];
    if (kind === "articles") {
      const type = field(item, "type", "articleType");
      const articlePrefix: Record<string, string> = {
        "1": "/blog/",
        "3": "/legal/",
        "5": "/cases/",
        "6": "/help/",
        "8": "/events/"
      };
      const target = articlePrefix[type];
      if (!target || (type === "3" && !["privacy", "terms"].includes(slug))) return [];
      const lastmod = sitemapDate(field(item, "publishedAt", "published_at", "lastmod"));
      return [{ path: target + slug, ...(lastmod ? { lastmod } : {}) }];
    }
    const lastmod = sitemapDate(field(item, "publishedAt", "published_at", "lastmod"));
    return [{ path: prefix + slug, ...(lastmod ? { lastmod } : {}) }];
  });
}

function taxonomySegment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > 80 || text === "." || text === ".." ||
    /[\\/?#\u0000-\u001f]/.test(text)) return null;
  return encodeURIComponent(text);
}

export function articleTaxonomyEntries(items: readonly RecordValue[], routeAvailable: boolean): SitemapEntry[] {
  if (!routeAvailable) return [];
  const paths = new Set<string>();
  for (const item of items) {
    if (!published(item, "articles") || field(item, "type", "articleType") !== "1") continue;
    const category = taxonomySegment(field(item, "category"));
    if (category) paths.add("/blog/cat/" + category);
    if (Array.isArray(item.tags)) {
      for (const tag of item.tags) {
        const segment = taxonomySegment(tag);
        if (segment) paths.add("/blog/tags/" + segment);
      }
    }
  }
  return [...paths].map((path) => ({ path }));
}

export function articleFeedEntries(items: readonly RecordValue[], routeAvailable: boolean): FeedEntry[] {
  if (!routeAvailable) return [];
  return items.flatMap((item): FeedEntry[] => {
    const slug = field(item, "slug");
    const type = field(item, "type", "articleType");
    if (!validSlug(slug) || !published(item, "articles") || (type && type !== "1")) return [];
    return [{
      slug,
      title: field(item, "title", "seoTitle") || slug,
      summary: field(item, "summary", "seoDescription", "description", "excerpt"),
      ...((field(item, "publishedAt", "published_at")) ? {
        publishedAt: field(item, "publishedAt", "published_at")
      } : {})
    }];
  });
}

export function buildSitemapXml(origin: string, entries: readonly SitemapEntry[]): string {
  const distinct = new Map<string, SitemapEntry>();
  for (const entry of entries) {
    const previous = distinct.get(entry.path);
    if (!previous || (entry.lastmod && (!previous.lastmod || entry.lastmod > previous.lastmod))) {
      distinct.set(entry.path, entry);
    }
  }
  const rows = [...distinct.values()].map((entry): string => {
    const loc = escapeXml(canonicalUrl(origin, entry.path));
    const lastmod = sitemapDate(entry.lastmod);
    return "  <url><loc>" + loc + "</loc>" +
      (lastmod ? "<lastmod>" + lastmod + "</lastmod>" : "") + "</url>";
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    rows.join("\n") + "\n</urlset>\n";
}

export function buildSitemapIndexXml(origin: string): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    "  <sitemap><loc>" + escapeXml(canonicalUrl(origin, "/sitemap.xml")) +
    "</loc></sitemap>\n</sitemapindex>\n";
}

export function buildRobotsTxt(origin: string): string {
  return "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /search\nDisallow: /status\n" +
    "Sitemap: " + canonicalUrl(origin, "/sitemap_index.xml") + "\n";
}

export function buildRssXml(origin: string, entries: readonly FeedEntry[]): string {
  const seen = new Set<string>();
  const rows = entries.flatMap((entry): string[] => {
    if (!validSlug(entry.slug) || seen.has(entry.slug)) return [];
    seen.add(entry.slug);
    const url = escapeXml(canonicalUrl(origin, "/blog/" + entry.slug));
    const pubDate = rssDate(entry.publishedAt);
    return [
      "    <item>",
      "      <title>" + escapeXml(entry.title) + "</title>",
      "      <link>" + url + "</link>",
      "      <guid isPermaLink=\"true\">" + url + "</guid>",
      "      <description>" + escapeXml(entry.summary) + "</description>",
      ...(pubDate ? ["      <pubDate>" + escapeXml(pubDate) + "</pubDate>"] : []),
      "    </item>"
    ];
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0"><channel>\n' +
    "  <title>数源 MathOrigin · 文章</title>\n" +
    "  <link>" + escapeXml(canonicalUrl(origin, SEO_ROUTE_AVAILABILITY.blog ? "/blog" : "/")) + "</link>\n" +
    "  <description>已发布的数学文章与学习思考。</description>\n" +
    rows.join("\n") + (rows.length ? "\n" : "") + "</channel></rss>\n";
}
