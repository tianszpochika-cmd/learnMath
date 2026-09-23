import { describe, expect, it } from "vitest";
import {
  STATIC_SITE_PATHS,
  articleFeedEntries,
  articleTaxonomyEntries,
  buildRobotsTxt,
  buildRssXml,
  buildSitemapIndexXml,
  buildSitemapXml,
  canonicalOrigin,
  canonicalUrl,
  collectPublicList,
  contentSitemapEntries,
  escapeXml,
  rssDate,
  sitemapDate,
  validSlug
} from "./seo";

describe("官网 O-05 SEO 纯逻辑", () => {
  it("只使用配置的 canonical origin，拒绝带路径、凭据和错误协议", () => {
    expect(canonicalOrigin("https://math.example/")).toBe("https://math.example");
    expect(canonicalUrl("https://math.example/", "/glossary/zero-law")).toBe("https://math.example/glossary/zero-law");
    expect(canonicalOrigin("https://math.example/other")).toBeNull();
    expect(canonicalOrigin("https://user:pass@math.example")).toBeNull();
    expect(canonicalOrigin("javascript:alert(1)")).toBeNull();
    expect(() => canonicalUrl("https://math.example", "//evil.example")).toThrow();
  });

  it("XML 转义文字且过滤非法字符；slug 不允许路径穿越", () => {
    expect(escapeXml('A & <B> "C" \u0000\uD800')).toBe("A &amp; &lt;B&gt; &quot;C&quot; ");
    expect(validSlug("pythagorean-1")).toBe(true);
    expect(validSlug("a".repeat(100))).toBe(true);
    expect(validSlug("a".repeat(101))).toBe(false);
    expect(validSlug("../admin")).toBe(false);
    expect(validSlug("bad?query")).toBe(false);
    expect(sitemapDate("2026-09-23T10:00:00Z")).toBe("2026-09-23");
    expect(sitemapDate("2026-02-30")).toBeNull();
    expect(rssDate("2026-09-23 10:00:00")).toBeNull();
  });

  it("收齐公开 API 的分页，单页失败时整个内容源不进入索引", async () => {
    const fetchPage = async (_kind: "glossary" | "formulas" | "articles", query: { page: number; size: number }) => ({
      code: 0,
      data: {
        items: query.page === 1
          ? [{ slug: "first", status: 3 }, { slug: "draft", status: "draft" }]
          : [{ slug: "second", status: 3 }],
        total: 3,
        page: query.page,
        size: query.size
      }
    });
    const result = await collectPublicList("glossary", fetchPage, { size: 2 });
    expect(result.map((item) => item.slug)).toEqual(["first", "second"]);
    const failed = await collectPublicList("glossary", async (_kind, query) => {
      if (query.page === 2) throw new Error("upstream unavailable");
      return { code: 0, data: { items: [{ slug: "first" }, { slug: "second" }], total: 3 } };
    }, { size: 2 });
    expect(failed).toEqual([]);
    expect(await collectPublicList("articles", async () => ({ code: 503, data: null }))).toEqual([]);
  });

  it("索引只含已落地静态路由和各类型已发布有效 slug", () => {
    expect(STATIC_SITE_PATHS).toContain("/");
    expect(STATIC_SITE_PATHS).toContain("/glossary");
    expect(STATIC_SITE_PATHS).toContain("/blog");
    expect(STATIC_SITE_PATHS).toContain("/pricing");
    expect(STATIC_SITE_PATHS).not.toContain("/search");
    expect(STATIC_SITE_PATHS).not.toContain("/status");
    const glossary = contentSitemapEntries("glossary", [
      { slug: "zero-law", status: 3, publishedAt: "2026-09-23T10:00:00Z" },
      { slug: "../bad", status: 3 },
      { slug: "draft", status: 2 }
    ], true);
    const formulas = contentSitemapEntries("formulas", [
      { id: 12, slug: "human-alias", status: 1 },
      { id: 13, status: 2 }
    ], true);
    const articles = contentSitemapEntries("articles", [
      { slug: "story", type: 1, status: 2 },
      { slug: "terms", type: 3, status: 2 },
      { slug: "case-1", type: 5, status: 2 },
      { slug: "unpublished", type: 1, status: 1 }
    ], true);
    expect(glossary).toEqual([{ path: "/glossary/zero-law", lastmod: "2026-09-23" }]);
    expect(formulas).toEqual([{ path: "/formulas/12" }]);
    expect(articles).toEqual([
      { path: "/blog/story" },
      { path: "/legal/terms" },
      { path: "/cases/case-1" }
    ]);
    expect(contentSitemapEntries("articles", [{ slug: "story", type: 1, status: 2 }], false)).toEqual([]);
    expect(articleTaxonomyEntries([
      { slug: "story", type: 1, status: 2, category: "数学史", tags: ["代数", "../bad"] },
      { slug: "draft", type: 1, status: 1, category: "草稿分类" }
    ], true)).toEqual([
      { path: "/blog/cat/%E6%95%B0%E5%AD%A6%E5%8F%B2" },
      { path: "/blog/tags/%E4%BB%A3%E6%95%B0" }
    ]);
    const xml = buildSitemapXml("https://math.example", [
      { path: "/" }, { path: "/" },
      { path: "/glossary/zero-law", lastmod: "2026-09-22" },
      ...glossary
    ]);
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml).toContain("<loc>https://math.example/glossary/zero-law</loc>");
    expect(xml).toContain("<lastmod>2026-09-23</lastmod>");
    expect(buildSitemapIndexXml("https://math.example")).toContain("https://math.example/sitemap.xml");
    expect(buildRobotsTxt("https://math.example")).toContain("Sitemap: https://math.example/sitemap_index.xml");
  });

  it("RSS 只接收已发布博客，保留真实发布日期并转义标题和摘要", () => {
    const items = articleFeedEntries([
      { slug: "math-origin", type: 1, status: 2, title: "A & B", summary: "<证明>", publishedAt: "2026-09-23T10:00:00+08:00" },
      { slug: "private", type: 1, status: 1, title: "草稿" },
      { slug: "terms", type: 3, status: 2, title: "协议" }
    ], true);
    expect(items).toHaveLength(1);
    const rss = buildRssXml("https://math.example", items);
    expect(rss).toContain("<title>A &amp; B</title>");
    expect(rss).toContain("<description>&lt;证明&gt;</description>");
    expect(rss).toContain("https://math.example/blog/math-origin");
    expect(rss).toContain("<pubDate>Wed, 23 Sep 2026 02:00:00 GMT</pubDate>");
    expect(rss).not.toContain("草稿");
    expect(rss).not.toContain("协议");
  });
});
