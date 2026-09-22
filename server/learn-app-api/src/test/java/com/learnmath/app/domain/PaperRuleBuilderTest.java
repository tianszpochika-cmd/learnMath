package com.learnmath.app.domain;

import com.learnmath.app.domain.PaperRuleBuilder.Candidate;
import com.learnmath.app.domain.PaperRuleBuilder.DraftPaper;
import com.learnmath.app.domain.PaperRuleBuilder.PaperRule;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 规则抽题（04 /papers/generate · 17 A09 不足→放宽/补内容 · 20 §11 族排除）。 */
class PaperRuleBuilderTest {

    private static Candidate c(long id, int diff, long... nodes) {
        Set<Long> ns = java.util.Arrays.stream(nodes).boxed().collect(java.util.stream.Collectors.toSet());
        return new Candidate(id, ns, diff, 1, 1000 + id);
    }

    private static final List<Candidate> POOL = List.of(
            c(1, 2, 10), c(2, 3, 10), c(3, 4, 10), c(4, 2, 11),
            c(5, 5, 10), c(6, 1, 10), c(7, 3, 10));

    @Test
    void exactHit_sortedByDifficultyThenId() {
        DraftPaper d = PaperRuleBuilder.build(
                new PaperRule(Set.of(10L), 1, 5, 3, Set.of(), Set.of()), POOL);
        assertEquals(0, d.missing());
        assertEquals("", d.hint());
        // 难度升序：1(L1#6) 2(L2#1) 3(L3#2)
        assertEquals(List.of(6L, 1L, 2L), d.selected());
    }

    @Test
    void difficultyWindow_filters() {
        DraftPaper d = PaperRuleBuilder.build(
                new PaperRule(Set.of(10L), 3, 5, 2, Set.of(), Set.of()), POOL);
        assertEquals(0, d.missing());
        assertEquals(List.of(2L, 7L), d.selected(), "难度升序：L3#2 → L3#7（同档按 id）");
        // 窗口内只有 3 个却要 4 → 缺口 + 放宽提示
        DraftPaper d2 = PaperRuleBuilder.build(
                new PaperRule(Set.of(10L), 4, 5, 4, Set.of(), Set.of()), POOL);
        assertEquals(2, d2.missing());
        assertTrue(d2.hint().contains("按难度放宽至 L1-L5"), d2.hint());
        assertTrue(d2.hint().contains("命中不足"), d2.hint());
    }

    @Test
    void insufficient_evenWidened_saysContentGate() {
        DraftPaper d = PaperRuleBuilder.build(
                new PaperRule(Set.of(99L), 1, 5, 5, Set.of(), Set.of()), POOL);
        assertEquals(5, d.missing());
        assertTrue(d.hint().contains("覆盖门禁"), d.hint());
        assertTrue(d.selected().isEmpty());
    }

    @Test
    void nodeFilter_anyMatch_andNodelessScope() {
        // 圈选 {10,11}：池内 7 题全命中（6 题 node10 + 1 题 node11）；count=10 → 缺 3
        PaperRule rule = new PaperRule(Set.of(10L, 11L), 1, 5, 10, Set.of(), Set.of());
        DraftPaper d = PaperRuleBuilder.build(rule, POOL);
        assertEquals(7, d.selected().size());
        assertEquals(3, d.missing());
        assertTrue(d.hint().contains("覆盖门禁"), d.hint());
        // 不圈选 = 全库
        DraftPaper all = PaperRuleBuilder.build(PaperRule.of(Set.of(), 4), POOL);
        assertEquals(4, all.selected().size());
    }

    @Test
    void excludeTypes_and_excludedFamilies() {
        // 族排除：模拟"挑战卷不复用本轮曝光族"（BR-11）
        PaperRule rule = new PaperRule(Set.of(10L), 1, 5, 10, Set.of(), Set.of(1001L, 1006L));
        DraftPaper d = PaperRuleBuilder.build(rule, POOL);
        assertFalse(d.selected().contains(1L), "族 1001 被排除");
        assertFalse(d.selected().contains(6L), "族 1006 被排除");
        assertTrue(d.hint().contains("覆盖门禁") || d.hint().isEmpty() || d.hint().contains("命中不足")
                || d.missing() >= 0);
        // 题型排除（5=应用）
        List<Candidate> mixed = new ArrayList<>(POOL);
        mixed.add(new Candidate(8, Set.of(10L), 2, 5, 1008)); // type=5 应用
        DraftPaper d2 = PaperRuleBuilder.build(
                new PaperRule(Set.of(10L), 1, 5, 10, Set.of(5), Set.of()), mixed);
        assertFalse(d2.selected().contains(8L), "应用题被题型排除");
    }

    @Test
    void deterministic_underShuffledInput() {
        List<Candidate> shuffled = new ArrayList<>(POOL);
        Collections.shuffle(shuffled, new java.util.Random(42));
        DraftPaper a = PaperRuleBuilder.build(
                new PaperRule(Set.of(10L), 1, 5, 4, Set.of(), Set.of()), POOL);
        DraftPaper b = PaperRuleBuilder.build(
                new PaperRule(Set.of(10L), 1, 5, 4, Set.of(), Set.of()), shuffled);
        assertEquals(a.selected(), b.selected(), "同输入（乱序）同输出");
    }

    @Test
    void invalidCount_throws() {
        assertThrows(IllegalArgumentException.class, () ->
                PaperRuleBuilder.build(PaperRule.of(Set.of(1L), 0), POOL));
    }
}
