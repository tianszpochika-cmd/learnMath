export interface SearchShortcut {
  title: string;
  description: string;
  to: string;
  group: string;
}

const destinations: Record<string, { prefix: string; label: string }> = {
  glossary: { prefix: "/glossary/", label: "数学词条" },
  formulas: { prefix: "/formulas/", label: "公式" },
  articles: { prefix: "/blog/", label: "文章" },
  paths: { prefix: "/paths/", label: "学习路径" },
  help: { prefix: "/help/", label: "帮助" }
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function entries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const source = record(value);
  for (const key of ["items", "records", "list", "results"]) {
    if (Array.isArray(source[key])) return source[key] as unknown[];
  }
  return [];
}

export function publicSearchResults(value: unknown): SearchShortcut[] {
  const source = record(value);
  const nested = source.groups;
  const groups = Array.isArray(nested)
    ? nested.map((group) => {
      const row = record(group);
      return [String(row.key || row.type || ""), group] as const;
    })
    : Object.entries(record(nested ?? source));
  const result: SearchShortcut[] = [];
  for (const [rawKey, candidates] of groups) {
    const key = ({ formula: "formulas", article: "articles", path: "paths", node: "glossary" } as Record<string, string>)[rawKey] || rawKey;
    const target = destinations[key];
    if (!target) continue;
    for (const item of entries(candidates).slice(0, 5)) {
      const row = record(item);
      const identifier = String(key === "formulas" ? row.id ?? row.slug ?? "" : row.slug ?? "");
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(identifier)) continue;
      result.push({
        title: String(row.title || row.name || identifier),
        description: String(row.summary || row.description || ""),
        to: target.prefix + identifier,
        group: target.label
      });
    }
  }
  return result;
}
