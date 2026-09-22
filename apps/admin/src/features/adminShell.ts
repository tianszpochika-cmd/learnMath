/**
 * 管理端骨架纯逻辑（17 §2 AD1 / §5 AD2 / §4 菜单序；可单测）。
 */

export interface MenuItem {
  name: string; // route name
  path: string;
  label: string;
  star?: boolean; // 三大自研标记（17 §2）
  inMenu?: boolean; // 子页（编辑器）不进菜单
}

export interface MenuSection {
  group: string;
  items: MenuItem[];
}

/** AD1 菜单（顺序=17 §2；lesson/question 编辑为子页不进菜单）。 */
export function menuSections(): MenuSection[] {
  return [
    {
      group: "总览",
      items: [{ name: "dashboard", path: "/dashboard", label: "运营大盘" }],
    },
    {
      group: "内容生产",
      items: [
        { name: "knowledge", path: "/knowledge", label: "知识点树" },
        { name: "graph-edge", path: "/knowledge/edges", label: "图谱边编辑", star: true },
        { name: "courses", path: "/courses", label: "课程章节" },
        { name: "questions", path: "/questions", label: "题库" },
        { name: "papers", path: "/papers", label: "组卷" },
        { name: "assessment-config", path: "/assessments", label: "测评配置" },
      ],
    },
    {
      group: "路径与引擎",
      items: [
        { name: "path-canvas", path: "/paths/editor", label: "路径编排器", star: true },
        { name: "chain-editor", path: "/deepdive-editor", label: "推理链编辑", star: true },
        { name: "topics", path: "/topics", label: "专题编排" },
        { name: "challenges", path: "/challenges", label: "挑战赛" },
      ],
    },
    {
      group: "运营",
      items: [
        { name: "users", path: "/users", label: "用户" },
        { name: "moderation", path: "/community/review", label: "社区审核", star: true },
        { name: "ai", path: "/ai", label: "AI/内容供给" },
        { name: "stats", path: "/stats", label: "数据统计" },
        { name: "system", path: "/system", label: "系统/日志" },
      ],
    },
  ];
}

/** 全部菜单路由名（守卫/高亮用）。 */
export function menuRouteNames(): string[] {
  return menuSections().flatMap((s) => s.items.map((i) => i.name));
}

// ---------- AD2 列表模板辅助 ----------

export interface FilterDef {
  key: string;
  label: string;
  type: "text" | "select";
  initial?: string;
  options?: string[];
}

export type FilterModel = Record<string, string>;

/** 过滤模型初值（select 默认首项或空）。 */
export function buildFilterModel(defs: FilterDef[]): FilterModel {
  const model: FilterModel = {};
  for (const d of defs ?? []) {
    if (d.initial !== undefined) {
      model[d.key] = d.initial;
    } else if (d.type === "select" && d.options && d.options.length > 0) {
      model[d.key] = d.options[0];
    } else {
      model[d.key] = "";
    }
  }
  return model;
}

/** 生效过滤数（与初值不同且非空 → 计 1；chips 单删用）。 */
export function activeFilterCount(defs: FilterDef[], model: FilterModel): number {
  const initial = buildFilterModel(defs);
  let n = 0;
  for (const d of defs ?? []) {
    const v = model[d.key];
    if (v !== undefined && v !== null && String(v) !== "" && String(v) !== String(initial[d.key])) {
      n += 1;
    }
  }
  return n;
}

/** 分页范围文案（AD2 底部："1-20 / 共 125"；0 → 暂无数据；越界页钳到末页）。 */
export function pageRange(total: number, page: number, size: number): string {
  if (total <= 0) {
    return "暂无数据";
  }
  const s = Math.max(1, size);
  const maxPage = Math.max(1, Math.ceil(total / s));
  const p = Math.min(Math.max(1, page), maxPage);
  const start = (p - 1) * s + 1;
  const end = Math.min(p * s, total);
  return `${start}-${end} / 共 ${total}`;
}

// ---------- 排序（点击循环：无 → asc → desc → 无） ----------

export interface SortState {
  col: string | null;
  dir: "asc" | "desc";
}

export function toggleSort(col: string, cur: SortState): SortState {
  if (cur.col !== col) {
    return { col, dir: "asc" };
  }
  if (cur.dir === "asc") {
    return { col, dir: "desc" };
  }
  return { col: null, dir: "asc" };
}

/** 稳定排序（数字按值、字符串按 locale；null/undefined 恒在末尾）。 */
export function sortedRows<T>(rows: T[], sort: SortState, valueOf: (r: T) => string | number | null | undefined): T[] {
  if (!sort.col) {
    return [...(rows ?? [])];
  }
  const list = [...(rows ?? [])];
  list.sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    let cmp = 0;
    if (typeof va === "number" && typeof vb === "number") {
      cmp = va - vb;
    } else {
      cmp = String(va).localeCompare(String(vb), "zh-Hans-CN");
    }
    return sort.dir === "asc" ? cmp : -cmp;
  });
  return list;
}
