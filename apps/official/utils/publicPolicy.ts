const publicPatterns: ReadonlyArray<{ method: string; pattern: RegExp }> = [
  { method: "GET", pattern: /^glossary(?:\/[a-zA-Z0-9-]+)?$/ },
  { method: "GET", pattern: /^formulas(?:\/[a-zA-Z0-9-]+)?$/ },
  { method: "GET", pattern: /^daily-question$/ },
  { method: "GET", pattern: /^stats\/public$/ },
  { method: "GET", pattern: /^explore\/search$/ },
  { method: "GET", pattern: /^articles(?:\/[a-zA-Z0-9-]+)?$/ },
  { method: "GET", pattern: /^legal\/(?:privacy|terms)$/ },
  { method: "POST", pattern: /^newsletter\/subscribe$/ },
  { method: "POST", pattern: /^navigation\/intents$/ }
];

export function allowedPublicPath(method: string, rawPath: string): string | null {
  const path = rawPath.replace(/^\/+|\/+$/g, "");
  return publicPatterns.some((entry) => entry.method === method.toUpperCase() && entry.pattern.test(path)) ? path : null;
}

export interface IntentPayload {
  targetType: "node" | "formula" | "question" | "event" | "path";
  targetId?: string;
  slug?: string;
  action: "read" | "drill" | "join" | "start";
  from: string;
}

export function validIntent(value: unknown): value is IntentPayload {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  const types = ["node", "formula", "question", "event", "path"];
  const actions = ["read", "drill", "join", "start"];
  const id = input.targetId ?? input.slug;
  return types.includes(String(input.targetType)) &&
    actions.includes(String(input.action)) &&
    typeof id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(id) &&
    typeof input.from === "string" && /^[a-zA-Z0-9_/-]{1,100}$/.test(input.from);
}
