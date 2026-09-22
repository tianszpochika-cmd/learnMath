package com.learnmath.app.domain;

import com.learnmath.app.common.ErrorCode;
import com.learnmath.app.domain.UnlockRuleEvaluator.AllOf;
import com.learnmath.app.domain.UnlockRuleEvaluator.AnyOf;
import com.learnmath.app.domain.UnlockRuleEvaluator.Context;
import com.learnmath.app.domain.UnlockRuleEvaluator.LadderRule;
import com.learnmath.app.domain.UnlockRuleEvaluator.MasteryRule;
import com.learnmath.app.domain.UnlockRuleEvaluator.PaperPassRule;
import com.learnmath.app.domain.UnlockRuleEvaluator.Result;
import com.learnmath.app.domain.UnlockRuleEvaluator.Rule;
import com.learnmath.app.domain.UnlockRuleEvaluator.StarsRule;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 解锁 DSL —— 02 §5.3 + 20 §1.3 语义（DR-01/阶梯/持久解锁）。
 */
class UnlockRuleEvaluatorTest {

    /** 测试假实现。 */
    static class FakeCtx implements Context {
        final Map<Long, BigDecimal> scores = new HashMap<>();
        final Map<Long, Integer> samples = new HashMap<>();
        final Map<Long, Boolean> edges = new HashMap<>();
        final Map<String, Double> ladderRates = new HashMap<>();
        final Map<String, Integer> ladderCounts = new HashMap<>();
        final Map<Long, Double> paperRates = new HashMap<>();
        int stars;
        final Set<Long> completed;

        FakeCtx(Set<Long> completed) {
            this.completed = completed;
        }

        @Override public Optional<BigDecimal> masteryScore(long nodeId) { return Optional.ofNullable(scores.get(nodeId)); }
        @Override public int masterySample(long nodeId) { return samples.getOrDefault(nodeId, 0); }
        @Override public boolean requiredEdgesSatisfied(long nodeId) { return edges.getOrDefault(nodeId, true); }
        @Override public Optional<Double> ladderRate(long nodeId, int difficulty) {
            return Optional.ofNullable(ladderRates.get(nodeId + "#" + difficulty));
        }
        @Override public int ladderCount(long nodeId, int difficulty) {
            return ladderCounts.getOrDefault(nodeId + "#" + difficulty, 0);
        }
        @Override public int totalStars() { return stars; }
        @Override public Optional<Double> paperBestRate(long paperId) { return Optional.ofNullable(paperRates.get(paperId)); }
        @Override public boolean previousCompleted(long nodeId) { return completed.contains(nodeId); }
    }

    private FakeCtx masteredCtx() {
        FakeCtx ctx = new FakeCtx(Set.of());
        ctx.scores.put(12L, new BigDecimal("85.00"));
        ctx.samples.put(12L, 8);
        ctx.edges.put(12L, true);
        return ctx;
    }

    @Test
    void masteryRule_pass() {
        Result r = UnlockRuleEvaluator.evaluate(new MasteryRule(12L, 80, 5), masteredCtx());
        assertTrue(r.allowed());
    }

    @Test
    void masteryRule_edgesFail_3311() {
        FakeCtx ctx = masteredCtx();
        ctx.edges.put(12L, false);
        Result r = UnlockRuleEvaluator.evaluate(new MasteryRule(12L, 80, 5), ctx);
        assertFalse(r.allowed());
        assertEquals(ErrorCode.PREREQUISITE_NOT_MET, r.code());
    }

    @Test
    void masteryRule_sampleLessThan5_refused() {
        // 20 §1.3：n<5 不据分解锁（哪怕分数很高）
        FakeCtx ctx = new FakeCtx(Set.of());
        ctx.scores.put(12L, new BigDecimal("100.00"));
        ctx.samples.put(12L, 4);
        Result r = UnlockRuleEvaluator.evaluate(new MasteryRule(12L, 80, 5), ctx);
        assertFalse(r.allowed());
        assertTrue(r.reason().contains("样本不足"));
    }

    @Test
    void masteryRule_boundary7999_80() {
        FakeCtx low = new FakeCtx(Set.of());
        low.scores.put(12L, new BigDecimal("79.99"));
        low.samples.put(12L, 6);
        assertFalse(UnlockRuleEvaluator.evaluate(new MasteryRule(12L, 80, 5), low).allowed());

        FakeCtx edge = new FakeCtx(Set.of());
        edge.scores.put(12L, new BigDecimal("80.00"));
        edge.samples.put(12L, 6);
        assertTrue(UnlockRuleEvaluator.evaluate(new MasteryRule(12L, 80, 5), edge).allowed());
    }

    @Test
    void ladderRule_boundary_8of10_at80() {
        // 20 样例：阶梯 8/10 → 晋级战可用（=阶梯达成）但下一难度锁定
        FakeCtx ctx = new FakeCtx(Set.of());
        ctx.ladderCounts.put("12#3", 10);
        ctx.ladderRates.put("12#3", 80.0);
        Result r = UnlockRuleEvaluator.evaluate(new LadderRule(12L, 3, 0.8, 10), ctx);
        assertTrue(r.allowed(), "阶梯达成 → 晋级战可用");

        // 晋级战未做 → 下一难度锁定
        Result next = UnlockRuleEvaluator.enterNextDifficulty(12L, 3, 77L, ctx);
        assertFalse(next.allowed());

        // 晋级战 80% → 下一难度解锁
        ctx.paperRates.put(77L, 80.0);
        assertTrue(UnlockRuleEvaluator.enterNextDifficulty(12L, 3, 77L, ctx).allowed());
    }

    @Test
    void ladderRule_notEnoughCount_messageShowsGap() {
        FakeCtx ctx = new FakeCtx(Set.of());
        ctx.ladderCounts.put("12#3", 8);
        ctx.ladderRates.put("12#3", 80.0);
        Result r = UnlockRuleEvaluator.evaluate(new LadderRule(12L, 3, 0.8, 10), ctx);
        assertFalse(r.allowed());
        assertEquals(ErrorCode.LADDER_NOT_MET, r.code());
        assertTrue(r.reason().contains("还差 2 题"), r.reason());
    }

    @Test
    void ladderSameFamilyRedo_countNotReachable() {
        // 20：同族 7 天重做 10 次最多 1 条有效证据 → 计数在写路径保证；此处验证 minCount 边界
        FakeCtx ctx = new FakeCtx(Set.of());
        ctx.ladderCounts.put("12#3", 9);
        ctx.ladderRates.put("12#3", 100.0);
        Result r = UnlockRuleEvaluator.evaluate(new LadderRule(12L, 3, 0.8, 10), ctx);
        assertFalse(r.allowed());
    }

    @Test
    void starsAndPaperPassAndComposite() {
        FakeCtx ctx = new FakeCtx(Set.of());
        ctx.stars = 46;
        assertTrue(UnlockRuleEvaluator.evaluate(new StarsRule(46), ctx).allowed());
        assertFalse(UnlockRuleEvaluator.evaluate(new StarsRule(60), ctx).allowed());

        ctx.paperRates.put(77L, 79.9);
        Result p = UnlockRuleEvaluator.evaluate(new PaperPassRule(77L, 80d), ctx);
        assertFalse(p.allowed());
        ctx.paperRates.put(77L, 80d);
        assertTrue(UnlockRuleEvaluator.evaluate(new PaperPassRule(77L, 80d), ctx).allowed());

        // allOf：一票否决；anyOf：一票通过
        Rule all = new AllOf(java.util.List.of(new StarsRule(46), new PaperPassRule(77L, 80d)));
        assertTrue(UnlockRuleEvaluator.evaluate(all, ctx).allowed());
        Rule allFail = new AllOf(java.util.List.of(new StarsRule(999), new PaperPassRule(77L, 80d)));
        assertFalse(UnlockRuleEvaluator.evaluate(allFail, ctx).allowed());
        Rule any = new AnyOf(java.util.List.of(new StarsRule(999), new PaperPassRule(77L, 80d)));
        assertTrue(UnlockRuleEvaluator.evaluate(any, ctx).allowed());
    }

    @Test
    void persistedUnlock_wins_evenIfScoreDrops() {
        // 20 §1.3：已得解锁即使变黄（分数回落）仍可进入；新节点按最新规则
        FakeCtx ctx = masteredCtx();
        ctx.scores.put(12L, new BigDecimal("61.00")); // 变黄
        Rule rule = new MasteryRule(12L, 80, 5);

        assertTrue(UnlockRuleEvaluator.canEnter(12L, Set.of(12L), rule, ctx), "持久解锁优先");
        assertFalse(UnlockRuleEvaluator.canEnter(12L, Set.of(), rule, ctx), "无持久记录则按最新规则拒绝");
        assertFalse(UnlockRuleEvaluator.evaluate(rule, ctx).allowed());
    }
}
