import { describe, expect, it } from "vitest";
import {
  ASK_PATH,
  adoptView,
  authorView,
  containsSensitive,
  duplicateLikeMessage,
  feedFilter,
  filterFeed,
  likeView,
  postPath,
  reportEnabled,
  reportHandleMessage,
  sortedReplies,
  submitFeedback,
  visibleToOthers,
  type PostCard,
} from "./communityUi";

describe("可见性与作者视图（02 §5.9 镜像）", () => {
  it("仅 ACTIVE 对他人可见", () => {
    expect(visibleToOthers("ACTIVE")).toBe(true);
    for (const s of ["HELD", "REJECTED", "TAKEN_DOWN", "DELETED"] as const) {
      expect(visibleToOthers(s)).toBe(false);
    }
  });

  it("作者视角五态文案（含 3401/3402）", () => {
    expect(authorView("ACTIVE")).toBe("已发布");
    expect(authorView("HELD")).toContain("审核中");
    expect(authorView("REJECTED")).toContain("未通过");
    expect(authorView("TAKEN_DOWN")).toContain("下架");
    expect(authorView("DELETED")).toContain("3402");
  });

  it("列表过滤：他人只见 ACTIVE；作者可见自己的 HELD(带徽标)", () => {
    const posts = [
      { state: "ACTIVE" as const, mine: false },
      { state: "HELD" as const, mine: true },
      { state: "HELD" as const, mine: false },
      { state: "DELETED" as const, mine: true },
    ];
    const other = feedFilter(posts, false);
    expect(other.map((x) => x.index)).toEqual([0]);
    expect(other[0].heldBadge).toBe(false);

    const mine = feedFilter(posts, true);
    expect(mine.map((x) => x.index)).toEqual([0, 1]);
    expect(mine[1].heldBadge).toBe(true);
    expect(feedFilter([], true)).toEqual([]);
  });
});

describe("发帖回执（命中→3401；未命中→先发后审）", () => {
  it("敏感词命中（大小写无关）", () => {
    const r1 = containsSensitive("快来领答案啦");
    expect(r1.hit).toBe(true);
    expect(r1.words).toContain("领答案");
    expect(containsSensitive("加V进群").hit).toBe(true), "toLowerCase 后比中加v";
    expect(containsSensitive("这步为什么除 sinC").hit).toBe(false);

    const fb = submitFeedback("这里有领答案群");
    expect(fb.ok).toBe(false);
    expect(fb.code).toBe(3401);
    expect(fb.message).toContain("审核中");
    expect(fb.intoReviewQueue).toBe(false);
  });

  it("干净内容 → 先发后审入队", () => {
    const fb = submitFeedback("请教这一步的依据是什么？");
    expect(fb.ok).toBe(true);
    expect(fb.code).toBe(0);
    expect(fb.message).toContain("先发后审");
    expect(fb.intoReviewQueue).toBe(true);
  });

  it("举报链：仅 ACTIVE 可报；结论文案", () => {
    expect(reportEnabled("ACTIVE")).toBe(true);
    expect(reportEnabled("HELD")).toBe(false);
    expect(reportHandleMessage(true)).toContain("3402");
    expect(reportHandleMessage(false)).toContain("恢复可见");
  });
});

describe("采纳与点赞", () => {
  it("采纳三态：可点/本答已采纳/已有采纳禁换绑", () => {
    expect(adoptView(null, "a1")).toEqual({ label: "采纳", cls: "available" });
    expect(adoptView("a1", "a1")).toEqual({ label: "✓ 已采纳", cls: "adopted" });
    expect(adoptView("a1", "a2")).toEqual({ label: "已有采纳", cls: "disabled" });
  });

  it("点赞展示与 3403 文案", () => {
    expect(likeView(11, false)).toEqual({ icon: "♡", count: 11 });
    expect(likeView(11, true)).toEqual({ icon: "♥", count: 11 });
    expect(likeView(-2, false).count).toBe(0);
    expect(duplicateLikeMessage()).toContain("3403");
  });
});

describe("列表过滤与回复排序", () => {
  const posts: PostCard[] = [
    { id: 1, title: "普通帖", author: "A", timeLabel: "1h", replyCount: 1, likeCount: 5 },
    { id: 2, title: "精华帖", author: "B", timeLabel: "2h", replyCount: 9, likeCount: 66, adopted: true },
    { id: 3, title: "话题帖", author: "C", timeLabel: "3h", replyCount: 3, likeCount: 12, topic: "三角学" },
    { id: 4, title: "高赞未采纳", author: "D", timeLabel: "4h", replyCount: 5, likeCount: 40 },
  ];

  it("三 Tab：最新全量 / 精华=采纳或高赞 / 话题按主题", () => {
    expect(filterFeed(posts, "latest")).toHaveLength(4);
    expect(filterFeed(posts, "essence").map((p) => p.id)).toEqual([2, 4]);
    expect(filterFeed(posts, "topic", "三角学").map((p) => p.id)).toEqual([3]);
    expect(filterFeed(posts, "topic")).toHaveLength(4), "未选主题=全量";
    expect(filterFeed([], "latest")).toEqual([]);
  });

  it("回复：已采纳置顶，其次赞数降序（稳定）", () => {
    const sorted = sortedReplies([
      { id: 1, author: "x", content: "c1", adopted: false, likeCount: 30 },
      { id: 2, author: "y", content: "c2", adopted: true, likeCount: 5 },
      { id: 3, author: "z", content: "c3", adopted: false, likeCount: 30 },
      { id: 4, author: "w", content: "c4", adopted: false, likeCount: 3 },
    ]);
    expect(sorted.map((r) => r.id)).toEqual([2, 1, 3, 4]);
    expect(sortedReplies([])).toEqual([]);
    expect(sortedReplies(undefined as never)).toEqual([]);
  });

  it("路径构造", () => {
    expect(postPath(88)).toBe("/community/post/88");
    expect(ASK_PATH).toBe("/community/ask");
  });
});
