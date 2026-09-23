import { describe, expect, it } from "vitest";
import { projectCommunityPage, projectPost } from "./community";

describe("社区可见性与回复投影", () => {
  it("公开列表不展示待审核/扣留帖", () => {
    const page = projectCommunityPage({ items: [
      { id: 1, title: "已发布", status: "ACTIVE" },
      { id: 2, title: "审核中", status: "PENDING" },
      { id: 3, title: "扣留", status: "HELD" },
      { id: 4, title: "草稿", status: "DRAFT" },
      { id: 5, title: "已删除", status: "DELETED" },
      { id: 6, title: "缺状态" },
    ] });
    expect(page.posts.map((post) => post.id)).toEqual(["1"]);
  });

  it("采纳仅来自服务端投影，不因本地点选而造状态", () => {
    const post = projectPost({ id: 1, title: "问题", replies: [
      { id: 2, content: "普通回复" },
      { id: 3, content: "已采纳", adopted: true },
    ] });
    expect(post?.replies.map((reply) => reply.id)).toEqual(["3", "2"]);
    expect(post?.replies[1]?.canAccept).toBe(false);
  });
});
