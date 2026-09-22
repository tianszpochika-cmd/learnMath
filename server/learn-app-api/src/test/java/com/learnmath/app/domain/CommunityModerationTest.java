package com.learnmath.app.domain;

import com.learnmath.app.domain.CommunityModeration.Action;
import com.learnmath.app.domain.CommunityModeration.State;
import com.learnmath.app.domain.CommunityModeration.SubmitResult;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 社区状态机 + 敏感词 AC（02 §5.9 · 09 L7）。 */
class CommunityModerationTest {

    private static CommunityModeration.SensitiveWords.AhoCorasick matcher() {
        CommunityModeration.SensitiveWords.Dict dict = new CommunityModeration.SensitiveWords.Dict()
                .add("营销", "领答案").add("营销", "加V")
                .add("自定义", "违禁词").add("自定义", "内部词A");
        return CommunityModeration.SensitiveWords.build(dict);
    }

    // ---------- AC 自动机 ----------

    @Test
    void ac_basicMatch_andGroups() {
        var ac = matcher();
        assertEquals(4, ac.patternCount());
        assertEquals(List.of("领答案"), ac.matchWords("快来加群领答案啦"));
        assertEquals(List.of("营销"), ac.matchGroups("快来领答案啦"), "组去重");
        assertTrue(ac.matchWords("正常的学习讨论").isEmpty());
        assertTrue(ac.matchWords(null).isEmpty());
    }

    @Test
    void ac_overlapping_andSubstringPattern() {
        var ac = CommunityModeration.SensitiveWords.build(
                new CommunityModeration.SensitiveWords.Dict()
                        .add("营销", "答案群").add("营销", "领答案群"));
        // 长词与短词重叠：同时命中两个模式
        List<String> hits = ac.matchWords("这里有领答案群哦");
        assertTrue(hits.contains("领答案群"));
        assertTrue(hits.contains("答案群"), "重叠短模式也命中");
    }

    @Test
    void ac_refreshIsAtomicSwap_newDictOnly() {
        var v1 = CommunityModeration.SensitiveWords.build(
                new CommunityModeration.SensitiveWords.Dict().add("营销", "旧词"));
        assertEquals(List.of("旧词"), v1.matchWords("旧词"));
        // 热替换：构建新实例（服务层原子换引用），旧实例行为不变
        var v2 = CommunityModeration.SensitiveWords.build(
                new CommunityModeration.SensitiveWords.Dict().add("营销", "新词"));
        assertTrue(v2.matchWords("旧词").isEmpty(), "新词库不再含旧词");
        assertEquals(List.of("新词"), v2.matchWords("新词"));
        assertEquals(List.of("旧词"), v1.matchWords("旧词"), "旧实例独立（替换期间在途请求）");
    }

    // ---------- 状态机 ----------

    @Test
    void submit_hitHeld3401_visibleToAuthorOnly() {
        SubmitResult held = CommunityModeration.submit("加V领答案", matcher());
        assertEquals(State.HELD, held.state());
        assertFalse(held.visibleToOthers());
        assertEquals(3401, held.code());
        assertTrue(held.message().contains("审核中"));
        assertTrue(held.hitGroups().contains("营销"));
        assertEquals("审核中（暂不可见）", CommunityModeration.authorView(held.state()));
        assertFalse(CommunityModeration.visibleToOthers(State.HELD));

        SubmitResult clean = CommunityModeration.submit("这步为什么除 sinC？", matcher());
        assertEquals(State.ACTIVE, clean.state());
        assertTrue(clean.intoReviewQueue(), "先发后审 → 抽审队列");
        assertTrue(CommunityModeration.visibleToOthers(clean.state()));
    }

    @Test
    void moderate_approveReject_restorePath() {
        // 扣留 → 通过 → 可见
        var approved = CommunityModeration.moderate(State.HELD, Action.APPROVE, null);
        assertTrue(approved.ok());
        assertEquals(State.ACTIVE, approved.newState());
        // 驳回 → 作者见理由
        var rejected = CommunityModeration.moderate(State.HELD, Action.REJECT, "命中营销词");
        assertEquals(State.REJECTED, rejected.newState());
        assertTrue(rejected.message().contains("命中营销词"));
        assertTrue(CommunityModeration.authorView(State.REJECTED).contains("未通过"));
        // 已删除不可操作（3402）
        assertFalse(CommunityModeration.moderate(State.DELETED, Action.APPROVE, null).ok());
        assertTrue(CommunityModeration.moderate(State.DELETED, Action.APPROVE, null).message().contains("3402"));
        // 幂等通过
        var idem = CommunityModeration.moderate(State.ACTIVE, Action.APPROVE, null);
        assertTrue(idem.ok());
        assertEquals(State.ACTIVE, idem.newState());
    }

    @Test
    void report_takedown_then_handleFoundOrNot() {
        var taken = CommunityModeration.report(State.ACTIVE);
        assertTrue(taken.ok());
        assertEquals(State.TAKEN_DOWN, taken.newState());
        assertFalse(CommunityModeration.visibleToOthers(State.TAKEN_DOWN));

        var founded = CommunityModeration.handleReport(State.TAKEN_DOWN, true, "重复发帖");
        assertEquals(State.DELETED, founded.newState());
        assertTrue(founded.message().contains("删除"));
        assertEquals("内容已删除（3402）", CommunityModeration.authorView(State.DELETED));

        var notFounded = CommunityModeration.handleReport(State.TAKEN_DOWN, false, null);
        assertEquals(State.ACTIVE, notFounded.newState());

        // 非待处理态拒绝对处理
        assertFalse(CommunityModeration.handleReport(State.ACTIVE, true, null).ok());
        // 非 ACTIVE 不可举报
        assertFalse(CommunityModeration.report(State.HELD).ok());
    }

    @Test
    void like_dedup3403_and_adoptOnce() {
        CommunityModeration.MemoryLikeState likes = new CommunityModeration.MemoryLikeState();
        assertTrue(CommunityModeration.like(likes, 1001L, 88L));
        assertFalse(CommunityModeration.like(likes, 1001L, 88L), "重复点赞 3403");
        assertTrue(CommunityModeration.like(likes, 1002L, 88L), "他人可赞");

        assertTrue(CommunityModeration.adoptOnce(null, "a1"));
        assertTrue(CommunityModeration.adoptOnce("a1", "a1"), "同答幂等");
        assertFalse(CommunityModeration.adoptOnce("a1", "a2"), "已有采纳不可换绑");
        assertFalse(CommunityModeration.adoptOnce(null, null));
    }
}
