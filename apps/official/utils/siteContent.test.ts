import { describe, expect, it } from "vitest";
import { features, findEntry, paths, siteSections } from "./siteContent";

describe("官网导航内容", () => {
  it("六条路径与八个功能具有稳定且唯一的详情标识", () => {
    expect(paths).toHaveLength(6);
    expect(features).toHaveLength(8);
    expect(new Set(paths.map((entry) => entry.slug)).size).toBe(paths.length);
    expect(new Set(features.map((entry) => entry.slug)).size).toBe(features.length);
    expect(paths.every((entry) => entry.steps.length === 3 && entry.boundary)).toBe(true);
    expect(features.every((entry) => entry.steps.length === 3 && entry.boundary)).toBe(true);
    expect(findEntry(paths, "missing")).toBeUndefined();
  });

  it("全站常驻导航只指向站内页面", () => {
    expect(siteSections.flatMap((section) => section.links).every((link) => /^\/[a-z0-9/-]+$/.test(link.to))).toBe(true);
  });
});
