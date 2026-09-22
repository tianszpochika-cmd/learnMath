package com.learnmath.app.domain;

import com.learnmath.app.domain.MasteryCalculator.GraphColor;
import com.learnmath.app.domain.MasteryCalculator.MasteryScore;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 图谱投影 —— 16 WD5 / 02 §5.1（色档优先级、必需边锁定、缓存键版本化）。 */
class GraphProjectionTest {

    private static final Instant T0 = Instant.parse("2026-09-22T00:00:00Z");

    private final List<GraphProjection.Node> nodes = List.of(
            new GraphProjection.Node(1L, null, "代数"),
            new GraphProjection.Node(2L, 1L, "方程"),
            new GraphProjection.Node(3L, 1L, "不等式"),
            new GraphProjection.Node(4L, 2L, "因式分解"));

    private final List<GraphProjection.DepEdge> edges = List.of(
            new GraphProjection.DepEdge(1L, 2L, true),
            new GraphProjection.DepEdge(3L, 4L, true),
            new GraphProjection.DepEdge(1L, 4L, false)); // 推荐边

    private static MasteryScore mastered() {
        return MasteryCalculator.compute(
                java.util.stream.IntStream.rangeClosed(1, 5)
                        .mapToObj(i -> new MasteryCalculator.Evidence(true, 3, T0)).toList(), T0);
    }

    private static MasteryScore unmastered() {
        return MasteryCalculator.compute(
                java.util.stream.IntStream.rangeClosed(1, 5)
                        .mapToObj(i -> new MasteryCalculator.Evidence(false, 3, T0)).toList(), T0);
    }

    @Test
    void subtree_includesDescendants_only() {
        Set<Long> sub = GraphProjection.subtreeIds(nodes, 2L);
        assertEquals(Set.of(2L, 4L), sub, "子树=2+其子4，不含 1/3");
        assertEquals(Set.of(1L, 2L, 3L, 4L), GraphProjection.subtreeIds(nodes, 1L));
        assertTrue(GraphProjection.subtreeIds(nodes, 99L).isEmpty(), "未知根 → 空");
    }

    @Test
    void colors_priority_preparing_over_locked_over_scores() {
        Map<Long, MasteryScore> scores = Map.of(
                2L, mastered(),      // → 有前置1必需：1 未测 → locked 红锁
                3L, unmastered());   // 无入边 → 分数档 黄
        GraphProjection.Projection p = GraphProjection.project(nodes, edges, null, scores,
                Set.of(4L));
        // node2：前置 1 未测量 → LOCKED（哪怕自身掌握）
        assertEquals(GraphColor.LOCKED, p.colorOf(2L));
        // node4：筹备中 → PREPARING 优先级最高（含覆盖锁定）
        assertEquals(GraphColor.PREPARING, p.colorOf(4L));
        // node3：无必需入边未掌握 → 黄（分数档）
        assertEquals(GraphColor.YELLOW, p.colorOf(3L));
        // node1：无分数 → 无数据
        assertEquals(GraphColor.NO_DATA, p.colorOf(1L));
    }

    @Test
    void recommendedEdge_doesNotLock_requiredDoes() {
        Map<Long, MasteryScore> scores = Map.of(1L, mastered(), 3L, mastered(), 4L, mastered());
        // 必需入边 3→4：3 已掌握 → 不锁；推荐边 1→4 不参与锁定
        assertFalse(GraphProjection.isPrerequisiteLocked(4L, edges, scores));

        Map<Long, MasteryScore> weak3 = Map.of(1L, mastered(), 3L, unmastered(), 4L, mastered());
        assertTrue(GraphProjection.isPrerequisiteLocked(4L, edges, weak3), "必需前置未掌握 → 锁");

        // 仅推荐边（1→4 required=false）指向未掌握 1 → 不锁
        List<GraphProjection.DepEdge> onlyRecommended = List.of(new GraphProjection.DepEdge(1L, 4L, false));
        Map<Long, MasteryScore> none = Map.of();
        assertFalse(GraphProjection.isPrerequisiteLocked(4L, onlyRecommended, none), "推荐边不锁");
    }

    @Test
    void sampleInsufficient_locksViaUnlockableGate() {
        // 前置样本不足（n<5 → unlockable=false）→ 后继红锁
        MasteryScore oneAnswer = MasteryCalculator.compute(
                List.of(new MasteryCalculator.Evidence(true, 3, T0)), T0);
        Map<Long, MasteryScore> scores = Map.of(1L, oneAnswer);
        assertTrue(GraphProjection.isPrerequisiteLocked(2L,
                List.of(new GraphProjection.DepEdge(1L, 2L, true)), scores));
    }

    @Test
    void subtreeProjection_edgesFilteredToScope() {
        Set<Long> scope = GraphProjection.subtreeIds(nodes, 2L);
        GraphProjection.Projection p = GraphProjection.project(nodes, edges, scope, Map.of(), Set.of());
        assertEquals(2, p.nodes().size());
        // 边 1→2 出界被滤；边 3→4 出界；只剩 1→4? from1 不在 scope → 0 边？ 推荐边 from=1 不在 scope
        assertTrue(p.edges().stream().allMatch(e -> scope.contains(e.from()) && scope.contains(e.to())));
        assertEquals(0, p.edges().size(), "scope={2,4} 内无边（1/3 出界）");
    }

    @Test
    void cacheKeys_versioned() {
        assertEquals("graph:adj:v7", GraphProjection.adjacencyCacheKey(7L));
        assertEquals("graph:subtree:3:v7", GraphProjection.subtreeCacheKey(3L, 7L));
        assertEquals("graph:user:9:v7", GraphProjection.userViewCacheKey(9L, 7L));
        assertFalse(GraphProjection.adjacencyCacheKey(7L).equals(GraphProjection.adjacencyCacheKey(8L)),
                "边版本变 → 键变 → 自然失效");
    }

    @Test
    void adjacency_export() {
        Map<Long, List<Long>> adj = GraphProjection.adjacencyOf(edges);
        assertEquals(List.of(2L, 4L), adj.get(1L), "含必需 1→2 与推荐 1→4");
        assertEquals(List.of(4L), adj.get(3L));
        assertTrue(BigDecimal.valueOf(1).signum() == 1);
    }
}
