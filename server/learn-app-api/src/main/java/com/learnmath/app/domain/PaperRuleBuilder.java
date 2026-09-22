package com.learnmath.app.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * 规则抽题（04 /papers/generate · 17 A09「命中不足→按难度放宽/手动补」· 20 §11 覆盖门禁口径；纯函数）。
 *
 * 规则：知识点圈选（命中任一即可）+ 难度区间 + 数量 + 题型排除 + 族排除
 *      （竞赛卷不复用本轮训练已曝光族 —— 20 §11/BR-11）。
 * 选取确定性：难度升序 → id 升序（同输入同输出，便于测试与审计）。
 */
public final class PaperRuleBuilder {

    /** 抽题规则。 */
    public record PaperRule(Set<Long> nodeIds, int minDifficulty, int maxDifficulty,
                            int count, Set<Integer> excludeTypes, Set<Long> excludeFamilies) {

        public static PaperRule of(Set<Long> nodeIds, int count) {
            return new PaperRule(nodeIds, 1, 5, count, Set.of(), Set.of());
        }
    }

    /** 候选题。 */
    public record Candidate(long id, Set<Long> nodeIds, int difficulty, int type, long familyId) {}

    /** 抽题结果：selected=实际选中 id；missing=缺口；hint=放宽/补内容建议（空=足额）。 */
    public record DraftPaper(List<Long> selected, int missing, String hint) {}

    private PaperRuleBuilder() {
    }

    public static DraftPaper build(PaperRule rule, List<Candidate> pool) {
        Objects.requireNonNull(rule, "rule");
        if (rule.count() <= 0) {
            throw new IllegalArgumentException("count 必须为正数");
        }
        List<Candidate> strict = pool == null ? List.of() : pool.stream()
                .filter(c -> matchesNodes(rule, c))
                .filter(c -> c.difficulty() >= rule.minDifficulty() && c.difficulty() <= rule.maxDifficulty())
                .filter(c -> !rule.excludeTypes().contains(c.type()))
                .filter(c -> !rule.excludeFamilies().contains(c.familyId()))
                .sorted(BY_DIFF_THEN_ID)
                .toList();

        if (strict.size() >= rule.count()) {
            return new DraftPaper(take(strict, rule.count()), 0, "");
        }
        // 不足 → 先看"仅放宽难度"能否足额（17 A09 弹层：按难度放宽 N→M）
        List<Candidate> widened = pool == null ? List.of() : pool.stream()
                .filter(c -> matchesNodes(rule, c))
                .filter(c -> !rule.excludeTypes().contains(c.type()))
                .filter(c -> !rule.excludeFamilies().contains(c.familyId()))
                .sorted(BY_DIFF_THEN_ID)
                .toList();
        String hint;
        if (widened.size() >= rule.count()) {
            int lo = widened.stream().mapToInt(Candidate::difficulty).min().orElse(1);
            int hi = widened.stream().mapToInt(Candidate::difficulty).max().orElse(5);
            hint = "命中不足：" + strict.size() + "/" + rule.count()
                    + " → 按难度放宽至 L" + lo + "-L" + hi + " 可命中 " + widened.size();
        } else {
            hint = "命中不足：" + strict.size() + "/" + rule.count()
                    + "，放宽难度仍仅 " + widened.size()
                    + " —— 需补内容或撤下可用声明（20 §11 覆盖门禁）";
        }
        return new DraftPaper(take(strict, strict.size()), rule.count() - strict.size(), hint);
    }

    private static boolean matchesNodes(PaperRule rule, Candidate c) {
        if (rule.nodeIds() == null || rule.nodeIds().isEmpty()) {
            return true; // 未圈选 = 全库（管理端允许，覆盖门禁另行提示）
        }
        return c.nodeIds().stream().anyMatch(rule.nodeIds()::contains);
    }

    private static List<Long> take(List<Candidate> sorted, int n) {
        List<Long> ids = new ArrayList<>();
        for (int i = 0; i < n && i < sorted.size(); i++) {
            ids.add(sorted.get(i).id());
        }
        return List.copyOf(ids);
    }

    private static final Comparator<Candidate> BY_DIFF_THEN_ID =
            Comparator.comparingInt(Candidate::difficulty).thenComparingLong(Candidate::id);
}
