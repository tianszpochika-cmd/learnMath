import { articleSlug } from "./ArticleData";
import { resourceItems, resourceRecord, type ResourceRecord } from "./ResourceData";

export interface ArticlePage {
  items: ResourceRecord[];
  page: number;
  size: number;
  total: number | null;
  hasMore: boolean;
}

export interface ArticleCollection {
  items: ResourceRecord[];
  available: boolean;
  hasMore: boolean;
  incomplete: boolean;
  page: number;
  size: number;
  total: number | null;
}

export function parseArticlePage(response: unknown, requestedPage: number, requestedSize: number): ArticlePage | null {
  const envelope = resourceRecord(response);
  if (envelope.code !== 0) return null;
  const data = resourceRecord(envelope.data);
  if (!Array.isArray(data.items)) return null;
  const page = data.page == null ? requestedPage : Number(data.page);
  const size = data.size == null ? requestedSize : Number(data.size);
  if (!Number.isSafeInteger(page) || page !== requestedPage ||
    !Number.isSafeInteger(size) || size < 1 || size > 100) return null;
  const totalValue = data.total == null ? null : Number(data.total);
  const total = totalValue !== null && Number.isSafeInteger(totalValue) && totalValue >= 0 ? totalValue : null;
  return {
    items: resourceItems(data.items),
    page,
    size,
    total,
    hasMore: total === null ? data.items.length >= size : page * size < total
  };
}

/** Category and tag pages must scan all available pages because the public API has no taxonomy filter. */
export async function collectArticlePages(
  fetchPage: (page: number) => Promise<ArticlePage | null>,
  maxPages = 20
): Promise<ArticleCollection> {
  const items: ResourceRecord[] = [];
  const seen = new Set<string>();
  let last: ArticlePage | null = null;
  for (let number = 1; number <= maxPages; number += 1) {
    let current: ArticlePage | null;
    try { current = await fetchPage(number); } catch { current = null; }
    if (!current) return {
      items, available: last !== null, hasMore: last?.hasMore ?? false,
      incomplete: last !== null, page: last?.page ?? 0, size: last?.size ?? 100,
      total: last?.total ?? null
    };
    const before = seen.size;
    for (const item of current.items) {
      const slug = articleSlug(item);
      if (slug && !seen.has(slug)) { seen.add(slug); items.push(item); }
    }
    last = current;
    if (!current.hasMore) return {
      items, available: true, hasMore: false, incomplete: false,
      page: current.page, size: current.size, total: current.total
    };
    // A proxy that ignores `page` would otherwise keep returning page one.
    if (seen.size === before) break;
  }
  return {
    items, available: true, hasMore: true, incomplete: true,
    page: last?.page ?? 0, size: last?.size ?? 100, total: last?.total ?? null
  };
}
