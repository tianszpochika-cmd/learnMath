import { describe, expect, it } from "vitest";
import { parseAdminTokens } from "./client";
import { projectChapters, projectCourses, projectEdges, projectKnowledgeTree, projectLesson, projectOverview } from "./content";

describe("管理端服务投影", () => {
  it("登录必须拿到完整管理域令牌，不用展示名冒充授权", () => {
    expect(parseAdminTokens({ accessToken: "a", refreshToken: "r", admin: { name: "内容管理员" } })).toEqual({ accessToken: "a", refreshToken: "r", adminName: "内容管理员" });
    expect(() => parseAdminTokens({ accessToken: "a" })).toThrow();
  });

  it("运营指标缺字段保持未提供，不生成演示数字", () => {
    expect(projectOverview({ dau: 18, answerCount: 42 })).toEqual({ dau: 18, newUsers: null, retention: null, answers: 42, accuracy: null });
  });

  it("知识树和依赖边保留服务端编号，畸形关键字段直接拒绝", () => {
    expect(projectKnowledgeTree([{ id: 1, name: "代数", status: 1, children: [{ id: 2, name: "方程", status: 2 }] }]))
      .toEqual([{ id: 1, parentId: null, title: "代数", status: "published", childrenCount: 1 }, { id: 2, parentId: 1, title: "方程", status: "offline", childrenCount: 0 }]);
    expect(projectEdges([{ id: 5, fromId: 1, toId: 2 }])).toEqual([{ id: "5", from: 1, to: 2 }]);
    expect(() => projectKnowledgeTree([{ id: 1, name: "代数" }])).toThrow();
    expect(() => projectEdges([{ id: 5, fromId: 1 }])).toThrow();
  });

  it("课程与课时只展示真实返回的字段，发布前客观题数未知单独标明", () => {
    expect(projectCourses({ items: [{ id: 4, title: "函数", status: 3 }], total: 1 }).items[0])
      .toEqual({ id: "4", title: "函数", status: "draft", chapterCount: null, lessonCount: null, updatedAt: "" });
    expect(projectChapters({ items: [{ id: 7, title: "第一章", lessons: [{ id: 8, title: "课时" }] }] })[0]?.lessons)
      .toEqual([{ id: "8", title: "课时" }]);
    const lesson = projectLesson({ title: "函数概念", type: 1, completionPolicy: 1, content: "正文", passRate: .8 });
    expect(lesson.objectiveCountKnown).toBe(false);
    expect(lesson.passRateKnown).toBe(true);
    expect(lesson.draft).toMatchObject({ title: "函数概念", type: "article", completionPolicy: "practice_required", passRate: 80, objectiveCount: 0 });
  });
});
