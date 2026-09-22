import { describe, expect, it } from "vitest";
import {
  PASS_RATE_MIN,
  courseStatusBadge,
  moveChapter,
  orderLabel,
  policyInlineHint,
  publishBlockers,
  publishDecision,
  type LessonDraft,
} from "./courseAdmin";

const base: LessonDraft = {
  title: "3.2 求根公式的来历",
  type: "article",
  content: "把 ax²+bx+c=0 配成完全平方…",
  videoUrl: "",
  completionPolicy: "practice_required",
  objectiveCount: 3,
  passRate: 80,
  durationSec: 600,
  readOnlyConfirmed: false,
};

describe("课时发布校验（BR-02 镜像）", () => {
  it("合法图文课时 → 无阻断", () => {
    expect(publishBlockers(base)).toEqual([]);
    expect(publishDecision(base, false).ok).toBe(true);
  });

  it("标题/正文/时长基础校验", () => {
    expect(publishBlockers({ ...base, title: "  " })).toContain("课时标题不能为空");
    expect(publishBlockers({ ...base, content: "" }).join("|")).toContain("正文不能为空");
    expect(publishBlockers({ ...base, durationSec: -1 })).toContain("时长不能为负数");
  });

  it("视频课时：必须 https 合法地址", () => {
    const v = { ...base, type: "video" as const, content: "" };
    expect(publishBlockers(v)).toContain("视频课时必须填写外链地址");
    expect(publishBlockers({ ...v, videoUrl: "http://insecure.example/x.mp4" }).join("|")).toContain("https");
    expect(publishBlockers({ ...v, videoUrl: "notaurl" }).join("|")).toContain("https");
    expect(publishBlockers({ ...v, videoUrl: "https://cdn.example.com/lesson.mp4" })).toEqual([]);
  });

  it("practice_required × 无客观题 → 后端同文案阻断（分母不为 0）", () => {
    const errs = publishBlockers({ ...base, objectiveCount: 0 });
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain("practice_required");
    expect(errs[0]).toContain("BR-02");
    expect(policyInlineHint({ ...base, objectiveCount: 0 })).toContain("分母为 0");
    expect(policyInlineHint(base)).toBeNull();
  });

  it("阈值域 80-100", () => {
    expect(publishBlockers({ ...base, passRate: 79 }).join("|")).toContain(String(PASS_RATE_MIN));
    expect(publishBlockers({ ...base, passRate: 101 }).join("|")).toContain("100");
    expect(publishBlockers({ ...base, passRate: 95 })).toEqual([]);
  });

  it("read_only 须显式确认；确认后放行", () => {
    const ro: LessonDraft = { ...base, completionPolicy: "read_only", objectiveCount: 0 };
    const blockers = publishBlockers(ro);
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain("显式确认");
    // 注意：read_only + 无客观题 不触发 practice_required 阻断（只缺确认）
    expect(publishDecision(ro, false).ok).toBe(false);
    expect(publishDecision({ ...ro, readOnlyConfirmed: true }, true).ok).toBe(true);
    expect(publishBlockers({ ...ro, readOnlyConfirmed: true })).toEqual([]);
  });

  it("多错并列不吞", () => {
    const errs = publishBlockers({
      ...base,
      title: "",
      content: "",
      objectiveCount: 0,
      durationSec: -1,
    });
    expect(errs.length).toBeGreaterThanOrEqual(4);
  });
});

describe("章节排序与状态徽标", () => {
  it("move 上下与越界保持", () => {
    const list = ["a", "b", "c"];
    expect(moveChapter(list, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveChapter(list, 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveChapter(list, 0, -1)).toEqual(["a", "b", "c"]), "首元素上移不动";
    expect(moveChapter(list, 2, 1)).toEqual(["a", "b", "c"]), "末元素下移不动";
    expect(moveChapter([], 0, 1)).toEqual([]);
    expect(list).toEqual(["a", "b", "c"]), "不改入参";
  });

  it("序号文案与越界钳制", () => {
    expect(orderLabel(0, 8)).toBe("1 / 8");
    expect(orderLabel(7, 8)).toBe("8 / 8");
    expect(orderLabel(99, 8)).toBe("8 / 8");
    expect(orderLabel(0, 0)).toBe("0 / 0");
  });

  it("课程状态徽标三色", () => {
    expect(courseStatusBadge("published")).toEqual({ label: "上架", cls: "gr" });
    expect(courseStatusBadge("draft")).toEqual({ label: "草稿", cls: "warn" });
    expect(courseStatusBadge("offline")).toEqual({ label: "下架", cls: "grey" });
  });
});
