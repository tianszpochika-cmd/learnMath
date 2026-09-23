import { describe, expect, it } from "vitest";
import { articleTags, publishedArticles } from "./ArticleData";
import { collectArticlePages, parseArticlePage } from "./ArticlePagination";

describe("article pagination", () => {
  it("uses the public API page metadata to decide whether more results exist", () => {
    const first = parseArticlePage({ code: 0, data: {
      items: [{ slug: "first", type: 1, status: 2 }], total: 2, page: 1, size: 1
    } }, 1, 1);
    expect(first?.hasMore).toBe(true);
    expect(parseArticlePage({ code: 0, data: { items: [], total: 2, page: 1, size: 1 } }, 2, 1)).toBeNull();
  });

  it("finds a category and tag even when their only article is on a later page", async () => {
    const pages = [
      { code: 0, data: { items: [{ slug: "first", type: 1, status: 2, category: "代数" }], total: 2, page: 1, size: 1 } },
      { code: 0, data: { items: [{ slug: "second", type: 1, status: 2, category: "几何", tags: ["图形"] }], total: 2, page: 2, size: 1 } }
    ];
    const collected = await collectArticlePages(async (page) => parseArticlePage(pages[page - 1], page, 1));
    const articles = publishedArticles(collected.items, 1);
    expect(collected.incomplete).toBe(false);
    expect(articles.filter((item) => item.category === "几何").map((item) => item.slug)).toEqual(["second"]);
    expect(articles.filter((item) => articleTags(item).includes("图形")).map((item) => item.slug)).toEqual(["second"]);
  });

  it("marks a capped or interrupted scan as incomplete instead of claiming an empty category", async () => {
    const first = parseArticlePage({ code: 0, data: {
      items: [{ slug: "first", type: 1, status: 2, category: "代数" }], total: 3, page: 1, size: 1
    } }, 1, 1);
    const capped = await collectArticlePages(async () => first, 1);
    expect(capped).toMatchObject({ available: true, incomplete: true, hasMore: true });
    const interrupted = await collectArticlePages(async (page) => page === 1 ? first : null);
    expect(interrupted).toMatchObject({ available: true, incomplete: true, hasMore: true });
    expect(interrupted.items).toHaveLength(1);
  });
});
