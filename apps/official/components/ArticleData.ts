import { resourceArray, resourceField, resourceItems, resourceRecord, resourceText, type ResourceRecord } from "./ResourceData";

/** Public article DTOs are deliberately treated as unknown until projected. */
export function articlePublished(value: unknown): boolean {
  const article = resourceRecord(value);
  const status = article.status ?? article.publishStatus;
  if (status === undefined || status === null || status === "") return true;
  if (status === 2 || status === "2") return true;
  return ["published", "active", "online"].includes(resourceText(status).toLowerCase());
}

export function articleType(value: unknown): number | null {
  const raw = resourceRecord(value).type;
  const n = Number(raw);
  return raw === undefined || raw === null || raw === "" || !Number.isFinite(n) ? null : n;
}

export function articleOfType(value: unknown, type: number): boolean {
  const found = articleType(value);
  return found === null || found === type;
}

export function articleSlug(value: unknown): string {
  const slug = resourceField(value, "slug");
  return /^[a-zA-Z0-9-]{1,100}$/.test(slug) ? slug : "";
}

export function publishedArticles(value: unknown, type: number): ResourceRecord[] {
  return resourceItems(value)
    .filter((item) => articlePublished(item) && articleOfType(item, type) && articleSlug(item))
    .sort((a, b) => Date.parse(resourceField(b, "publishedAt", "published_at")) - Date.parse(resourceField(a, "publishedAt", "published_at")));
}

export function articleTags(value: unknown): string[] {
  const article = resourceRecord(value);
  const tags = resourceArray(article.tags);
  if (tags.length) return tags.map(resourceText).filter(Boolean);
  const text = resourceField(article, "tags", "tagNames");
  return text ? text.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) : [];
}

export function articleBody(value: unknown): string {
  const article = resourceRecord(value);
  const raw = resourceField(article, "content", "body", "text");
  // Article content is Markdown in the content schema. Keep it as text to avoid
  // executing unsanitized HTML delivered by a remote content service.
  return raw.replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/(?:p|div|h[1-6]|li)\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
}

export function articleBlocks(value: unknown): Array<{ kind: "heading" | "text" | "list"; text: string }> {
  return articleBody(value).split(/\n\s*\n/).map((block) => {
    const text = block.trim();
    if (/^#{1,3}\s+/.test(text)) return { kind: "heading" as const, text: text.replace(/^#{1,3}\s+/, "") };
    if (/^(?:[-*]\s+|\d+\.\s+)/.test(text)) return { kind: "list" as const, text: text.replace(/^(?:[-*]\s+|\d+\.\s+)/gm, "• ") };
    return { kind: "text" as const, text };
  }).filter((block) => block.text);
}
